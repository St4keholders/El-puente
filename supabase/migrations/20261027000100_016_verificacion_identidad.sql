-- 016_verificacion_identidad.sql
-- Implementación completa de verificación de identidad con Didit, comparación de titularidad y suspensión por reportes.

-- 1. Tipo enumerado para estados de verificación
do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum
      ('pendiente', 'aprobada', 'rechazada', 'en_revision', 'vencida');
  end if;
end $$;

-- 2. Tabla de verificaciones de identidad
create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'didit',
  provider_session_id text unique,
  status public.verification_status not null default 'pendiente',
  level smallint not null default 1,
  verified_full_name text,       -- privado, nunca público
  document_country text,         -- ISO alfa-2
  document_hash text,            -- sha256(numero + PEPPER). Nunca el número
  decline_reason text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists identity_verifications_user_created_idx
  on public.identity_verifications (user_id, created_at desc);

-- Un documento, una cuenta
create unique index if not exists identidad_documento_unico
  on public.identity_verifications (document_hash)
  where status = 'aprobada' and document_hash is not null;

-- 3. Tabla de deduplicación de webhooks Didit
create table if not exists public.didit_webhook_events (
  event_id text primary key,
  session_id text,
  webhook_type text,
  processed_at timestamptz not null default now()
);

-- 4. Modificaciones a profiles y causes
alter table public.profiles
  add column if not exists identity_verified boolean not null default false,
  add column if not exists identity_verified_at timestamptz;

alter table public.causes
  add column if not exists holder_match boolean,
  add column if not exists holder_checked_at timestamptz,
  add column if not exists hidden_reason text;

-- 5. RLS y permisos
alter table public.identity_verifications enable row level security;
alter table public.didit_webhook_events enable row level security;

-- Solo la persona dueña puede leer sus propias verificaciones
drop policy if exists "identity_verifications_select_own" on public.identity_verifications;
create policy "identity_verifications_select_own" on public.identity_verifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Ninguna escritura directa desde cliente en identity_verifications ni didit_webhook_events
revoke insert, update, delete on public.identity_verifications from public, anon, authenticated;
grant select on public.identity_verifications to authenticated;

revoke all on public.didit_webhook_events from public, anon, authenticated;

-- Protegemos columnas que solo el servidor debe actualizar
revoke update(identity_verified, identity_verified_at) on public.profiles from anon, authenticated;
revoke update(holder_match, holder_checked_at) on public.causes from anon, authenticated;

-- 6. Comparación de titularidad de cuenta con nombre verificado
create or replace function public.titular_coincide(p_verificado text, p_titular text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  a text; b text; toks_a text[]; toks_b text[]; comunes int;
begin
  if p_verificado is null or p_titular is null then return false; end if;
  a := lower(extensions.unaccent(trim(p_verificado)));
  b := lower(extensions.unaccent(trim(p_titular)));
  a := regexp_replace(a, '\m(de|del|la|las|los|y|da|dos)\M', ' ', 'g');
  b := regexp_replace(b, '\m(de|del|la|las|los|y|da|dos)\M', ' ', 'g');
  toks_a := array(select t from unnest(regexp_split_to_array(a, '\s+')) t where length(t) >= 3);
  toks_b := array(select t from unnest(regexp_split_to_array(b, '\s+')) t where length(t) >= 3);
  if array_length(toks_a, 1) is null or array_length(toks_b, 1) is null then return false; end if;
  select count(*) into comunes from unnest(toks_b) t where t = any (toks_a);
  -- Coincide si al menos 2 palabras largas son iguales, o si el titular es un subconjunto del nombre
  return comunes >= 2 or comunes = array_length(toks_b, 1);
end $$;

grant execute on function public.titular_coincide(text, text) to anon, authenticated;

-- 7. Función revisar_titularidad
create or replace function public.revisar_titularidad(p_cause_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_author_id uuid;
  v_col_type text;
  v_verified_name text;
  v_total_methods int;
  v_matched_methods int;
  v_match boolean;
begin
  select c.author_id, c.collection_type::text into v_author_id, v_col_type
  from public.causes c
  where c.id = p_cause_id;

  if v_author_id is null then
    return false;
  end if;

  select verified_full_name into v_verified_name
  from public.identity_verifications
  where user_id = v_author_id
    and status = 'aprobada'
    and (expires_at is null or expires_at > now())
  order by verified_at desc nulls last, created_at desc
  limit 1;

  if v_verified_name is null or trim(v_verified_name) = '' then
    update public.causes
    set holder_match = false,
        holder_checked_at = now()
    where id = p_cause_id;
    return false;
  end if;

  select count(*), count(*) filter (where public.titular_coincide(v_verified_name, dm.account_holder))
  into v_total_methods, v_matched_methods
  from public.donation_methods dm
  where dm.cause_id = p_cause_id;

  if v_total_methods > 0 then
    v_match := (v_matched_methods = v_total_methods);
  elsif v_col_type = 'insumos' then
    v_match := true;
  else
    v_match := false;
  end if;

  update public.causes
  set holder_match = v_match,
      holder_checked_at = now()
  where id = p_cause_id;

  return v_match;
end $$;

revoke execute on function public.revisar_titularidad(uuid) from public, anon;
grant execute on function public.revisar_titularidad(uuid) to authenticated;

-- 8. Trigger en donation_methods para actualizar holder_match al cambiar métodos de pago
create or replace function public.handle_donation_method_holder_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_cause_id uuid;
begin
  v_cause_id := coalesce(new.cause_id, old.cause_id);
  if v_cause_id is not null then
    perform public.revisar_titularidad(v_cause_id);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists on_donation_method_holder_check on public.donation_methods;
create trigger on_donation_method_holder_check
  after insert or update or delete on public.donation_methods
  for each row execute function public.handle_donation_method_holder_check();

-- 9. Actualización de enforce_cause_status con bloqueo de verificación y titularidad
create or replace function public.enforce_cause_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n_img int;
  n_res_img int;
  author_name text;
begin
  if new.status = old.status then
    if old.status = 'finalizada' and (new.title, new.description, new.category, new.country_code, new.city)
       is distinct from (old.title, old.description, old.category, old.country_code, old.city) then
      raise exception 'CAUSA_BLOQUEADA' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.status = 'oculta' or old.status = 'oculta' then
    if current_user in ('anon', 'authenticated') then
      raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status = 'borrador' and new.status = 'activa' then
    if not exists (select 1 from public.profile_private where id = new.author_id and phone is not null) then
      raise exception 'REQ_TELEFONO' using errcode = 'P0001';
    end if;

    -- Verificación de identidad obligatoria
    if not exists (
      select 1 from public.identity_verifications v
      where v.user_id = new.author_id and v.status = 'aprobada'
        and (v.expires_at is null or v.expires_at > now())
    ) then
      raise exception 'REQ_VERIFICACION' using errcode = 'P0001';
    end if;

    -- Titularidad de métodos de pago
    if not public.revisar_titularidad(new.id) then
      raise exception 'REQ_TITULAR' using errcode = 'P0001';
    end if;

    select count(*) into n_img from public.cause_media
      where cause_id = new.id and phase = 'causa' and kind = 'imagen';
    select full_name into author_name from public.profiles where id = new.author_id;
    if n_img < 2 then raise exception 'REQ_IMAGENES' using errcode = 'P0001'; end if;
    if char_length(coalesce(new.title, '')) not between 10 and 90 then raise exception 'REQ_TITULO' using errcode = 'P0001'; end if;
    if char_length(coalesce(new.description, '')) < 80 then raise exception 'REQ_DESCRIPCION' using errcode = 'P0001'; end if;
    if new.country_code is null or new.city is null or new.lat is null or new.lng is null then
      raise exception 'REQ_UBICACION' using errcode = 'P0001';
    end if;

    -- Validaciones según collection_type
    if new.collection_type in ('dinero', 'ambas') then
      if not exists (select 1 from public.donation_methods where cause_id = new.id) then
        raise exception 'REQ_METODOS' using errcode = 'P0001';
      end if;
    end if;

    if new.collection_type in ('insumos', 'ambas') then
      if not exists (select 1 from public.cause_supplies where cause_id = new.id) then
        raise exception 'REQ_INSUMOS' using errcode = 'P0001';
      end if;
      if char_length(coalesce(new.supplies_instructions, '')) < 20 then
        raise exception 'REQ_ENTREGA' using errcode = 'P0001';
      end if;
    end if;

    if char_length(coalesce(author_name, '')) < 2 then raise exception 'REQ_PERFIL' using errcode = 'P0001'; end if;
    new.published_at := now();
  elsif old.status = 'activa' and new.status = 'cerrada' then
    new.closed_at := now();
  elsif old.status = 'cerrada' and new.status = 'finalizada' then
    if not exists (select 1 from public.cause_results where cause_id = new.id) then
      raise exception 'REQ_RESULTADOS' using errcode = 'P0001';
    end if;
    select count(*) into n_res_img from public.cause_media
      where cause_id = new.id and phase = 'resultado' and kind = 'imagen';
    if n_res_img < 1 then raise exception 'REQ_FOTO_DESPUES' using errcode = 'P0001'; end if;
    new.finalized_at := now();
  else
    raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 10. Suspensión automática por 3 reportes
create or replace function public.handle_cause_report_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_report_count int;
begin
  if new.cause_id is not null then
    select count(distinct reporter_id) into v_report_count
    from public.reports
    where cause_id = new.cause_id;

    if v_report_count >= 3 then
      update public.causes
      set status = 'oculta',
          hidden_reason = 'Causa suspendida por acumulación de reportes de la comunidad.'
      where id = new.cause_id and status <> 'oculta';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists on_cause_report_suspension on public.reports;
create trigger on_cause_report_suspension
  after insert on public.reports
  for each row execute function public.handle_cause_report_suspension();

-- 11. Teléfono obligatorio en complete_onboarding
create or replace function public.complete_onboarding(
  p_full_name text,
  p_phone text,
  p_terms_version text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if v_uid is null then
    raise exception 'SIN_SESION' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 5 and 80
     or coalesce(array_length(string_to_array(v_name, ' '), 1), 0) < 2 then
    raise exception 'REG_NOMBRE' using errcode = 'P0001';
  end if;

  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'REG_TELEFONO' using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(p_terms_version, '')), '') is null then
    raise exception 'REG_TERMINOS' using errcode = 'P0001';
  end if;

  update public.profiles
     set full_name = v_name,
         onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = v_uid;

  if not found then
    insert into public.profiles (id, full_name, onboarding_completed_at)
    values (v_uid, v_name, now());
  end if;

  insert into public.profile_private (id, phone, terms_version, terms_accepted_at)
  values (v_uid, v_phone, p_terms_version, now())
  on conflict (id) do update
    set phone = excluded.phone,
        terms_version = excluded.terms_version,
        terms_accepted_at = excluded.terms_accepted_at;
end $$;

revoke execute on function public.complete_onboarding(text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text) to authenticated;

-- 12. RPC procesar_verificacion_didit para webhook
create or replace function public.procesar_verificacion_didit(
  p_event_id text,
  p_session_id text,
  p_user_id uuid,
  p_status text,
  p_full_name text default null,
  p_country text default null,
  p_document_hash text default null,
  p_decline_reason text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_status public.verification_status;
  v_dup_user uuid;
  v_final_status public.verification_status;
  v_final_reason text := p_decline_reason;
  v_c record;
begin
  -- Deduplicación por event_id
  if p_event_id is not null then
    insert into public.didit_webhook_events (event_id, session_id, webhook_type)
    values (p_event_id, p_session_id, p_status)
    on conflict (event_id) do nothing;

    if not found then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
  end if;

  -- Mapeo de status
  case lower(p_status)
    when 'approved' then v_status := 'aprobada';
    when 'declined' then v_status := 'rechazada';
    when 'in review', 'in_review' then v_status := 'en_revision';
    when 'expired', 'kyc expired' then v_status := 'vencida';
    when 'not started', 'in progress' then v_status := 'pendiente';
    else
      if p_status in ('pendiente', 'aprobada', 'rechazada', 'en_revision', 'vencida') then
        v_status := p_status::public.verification_status;
      else
        v_status := 'pendiente';
      end if;
  end case;

  v_final_status := v_status;

  -- Si es aprobada, verificar si document_hash ya está en otra cuenta
  if v_status = 'aprobada' and p_document_hash is not null then
    select user_id into v_dup_user
    from public.identity_verifications
    where document_hash = p_document_hash
      and status = 'aprobada'
      and user_id <> p_user_id
    limit 1;

    if v_dup_user is not null then
      v_final_status := 'en_revision';
      v_final_reason := 'Documento ya registrado en otra cuenta';
    end if;
  end if;

  -- Insertar o actualizar registro de verificación
  insert into public.identity_verifications (
    user_id,
    provider,
    provider_session_id,
    status,
    level,
    verified_full_name,
    document_country,
    document_hash,
    decline_reason,
    verified_at,
    expires_at,
    updated_at
  )
  values (
    p_user_id,
    'didit',
    p_session_id,
    v_final_status,
    1,
    p_full_name,
    p_country,
    p_document_hash,
    v_final_reason,
    case when v_final_status = 'aprobada' then now() else null end,
    case when v_final_status = 'aprobada' then now() + interval '24 months' else null end,
    now()
  )
  on conflict (provider_session_id) do update set
    status = excluded.status,
    verified_full_name = coalesce(excluded.verified_full_name, public.identity_verifications.verified_full_name),
    document_country = coalesce(excluded.document_country, public.identity_verifications.document_country),
    document_hash = coalesce(excluded.document_hash, public.identity_verifications.document_hash),
    decline_reason = excluded.decline_reason,
    verified_at = coalesce(excluded.verified_at, public.identity_verifications.verified_at),
    expires_at = coalesce(excluded.expires_at, public.identity_verifications.expires_at),
    updated_at = now();

  -- Si quedó aprobada, actualizar profiles y revisar causas borrador / activas
  if v_final_status = 'aprobada' then
    update public.profiles
    set identity_verified = true,
        identity_verified_at = now()
    where id = p_user_id;

    for v_c in select id from public.causes where author_id = p_user_id loop
      perform public.revisar_titularidad(v_c.id);
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_final_status,
    'session_id', p_session_id
  );
end $$;

revoke execute on function public.handle_cause_report_suspension() from public, anon, authenticated;
revoke execute on function public.handle_donation_method_holder_check() from public, anon, authenticated;
revoke execute on function public.revisar_titularidad(uuid) from public, anon, authenticated;
revoke execute on function public.procesar_verificacion_didit(text, text, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.procesar_verificacion_didit(text, text, uuid, text, text, text, text, text) to service_role;
