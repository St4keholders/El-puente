-- 020_registro_empresas_y_tutorial.sql
-- 1. Registro ampliado: nombres y apellidos por separado, año de nacimiento (mínimo 14 años).
-- 2. Cuentas de empresa: nombre comercial + NIT opcional. Lo que se verifica es la persona
--    representante; en público se ve "Empresa · Nombres PrimerApellido".
-- 3. Publicar causas solo con 18 años cumplidos (fecha del documento verificado).
-- 4. Una sola causa de ejemplo para el tutorial; no cuenta en el planeta ni en el feed.
-- 5. Permisos más cerrados en profile_private y en la foto de perfil.

-- ───────────── 1. Columnas nuevas ─────────────
alter table public.profiles
  add column if not exists account_type text not null default 'persona',
  add column if not exists company_name text,
  add column if not exists company_verified boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_account_type_chk') then
    alter table public.profiles add constraint profiles_account_type_chk
      check (account_type in ('persona', 'empresa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_company_name_chk') then
    alter table public.profiles add constraint profiles_company_name_chk
      check (
        (account_type = 'persona' and company_name is null)
        or (account_type = 'empresa' and char_length(btrim(company_name)) between 2 and 80)
      );
  end if;
end $$;

alter table public.profile_private
  add column if not exists given_names text,
  add column if not exists last_names text,
  add column if not exists birth_year smallint,
  add column if not exists company_nit text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_private_birth_year_chk') then
    alter table public.profile_private add constraint profile_private_birth_year_chk
      check (birth_year is null or birth_year between 1900 and 2100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profile_private_nit_chk') then
    alter table public.profile_private add constraint profile_private_nit_chk
      check (company_nit is null or company_nit ~ '^[0-9]{6,12}(-[0-9])?$');
  end if;
end $$;

alter table public.identity_verifications
  add column if not exists verified_birth_date date;
grant select (verified_birth_date) on public.identity_verifications to authenticated;

-- ───────────── 2. Permisos: lo sensible solo por funciones ─────────────
-- Antes la app podía escribir cualquier columna de profile_private (incluido phone_verified_at).
revoke insert, update on public.profile_private from anon, authenticated;
grant insert (id, phone) on public.profile_private to authenticated;
grant update (id, phone) on public.profile_private to authenticated;

-- Empresa y verificación de empresa no se cambian desde el cliente
revoke update (account_type, company_name, company_verified) on public.profiles from anon, authenticated;

-- ───────────── 3. Registro (nueva versión de complete_onboarding) ─────────────
create or replace function public.complete_onboarding(
  p_given_names text,
  p_last_names text,
  p_full_name text,
  p_phone text,
  p_terms_version text,
  p_birth_year integer,
  p_account_type text default 'persona',
  p_company_name text default null,
  p_company_nit text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_nombres text := btrim(regexp_replace(coalesce(p_given_names, ''), '\s+', ' ', 'g'));
  v_apellidos text := btrim(regexp_replace(coalesce(p_last_names, ''), '\s+', ' ', 'g'));
  v_full text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_tipo text := coalesce(nullif(btrim(p_account_type), ''), 'persona');
  v_empresa text := nullif(btrim(regexp_replace(coalesce(p_company_name, ''), '\s+', ' ', 'g')), '');
  v_nit text := nullif(regexp_replace(coalesce(p_company_nit, ''), '[\s.]', '', 'g'), '');
  v_anio_actual int := extract(year from now())::int;
  v_verificado boolean;
  v_empresa_verificada boolean;
begin
  if v_uid is null then
    raise exception 'SIN_SESION' using errcode = 'P0001';
  end if;

  if char_length(v_nombres) not between 2 and 60 or char_length(v_apellidos) not between 2 and 60 then
    raise exception 'REG_NOMBRE' using errcode = 'P0001';
  end if;

  -- Mínimo 14 años para registrarse (publicar exige 18, ver validar_edad_publicacion)
  if p_birth_year is null or p_birth_year < 1900 or v_anio_actual - p_birth_year < 14 then
    raise exception 'REG_EDAD' using errcode = 'P0001';
  end if;

  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'REG_TELEFONO' using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(p_terms_version, '')), '') is null then
    raise exception 'REG_TERMINOS' using errcode = 'P0001';
  end if;

  if v_tipo not in ('persona', 'empresa') then
    raise exception 'REG_TIPO' using errcode = 'P0001';
  end if;

  select identity_verified, company_verified into v_verificado, v_empresa_verificada
  from public.profiles where id = v_uid;

  if v_tipo = 'empresa' then
    if v_empresa is null or char_length(v_empresa) not between 2 and 80 then
      raise exception 'REG_EMPRESA' using errcode = 'P0001';
    end if;
    -- Nadie puede registrarse como "Puente" salvo la cuenta oficial
    if v_empresa ~* 'puente' and not coalesce(v_empresa_verificada, false) then
      raise exception 'REG_EMPRESA_RESERVADA' using errcode = 'P0001';
    end if;
    if v_nit is not null and v_nit !~ '^[0-9]{6,12}(-[0-9])?$' then
      raise exception 'REG_NIT' using errcode = 'P0001';
    end if;
  else
    v_empresa := null;
    v_nit := null;
  end if;

  if char_length(v_full) not between 2 and 120 then
    raise exception 'REG_NOMBRE' using errcode = 'P0001';
  end if;

  update public.profiles
     set full_name = case when coalesce(v_verificado, false) then full_name else v_full end,
         account_type = case when coalesce(v_verificado, false) then account_type else v_tipo end,
         company_name = case when coalesce(v_verificado, false) then company_name else v_empresa end,
         onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = v_uid;

  if not found then
    insert into public.profiles (id, full_name, account_type, company_name, onboarding_completed_at)
    values (v_uid, v_full, v_tipo, v_empresa, now());
  end if;

  insert into public.profile_private (id, phone, terms_version, terms_accepted_at, given_names, last_names, birth_year, company_nit)
  values (v_uid, v_phone, p_terms_version, now(), v_nombres, v_apellidos, p_birth_year, v_nit)
  on conflict (id) do update
    set phone = excluded.phone,
        terms_version = excluded.terms_version,
        terms_accepted_at = excluded.terms_accepted_at,
        given_names = excluded.given_names,
        last_names = excluded.last_names,
        birth_year = excluded.birth_year,
        company_nit = coalesce(excluded.company_nit, public.profile_private.company_nit);
end $$;
revoke execute on function public.complete_onboarding(text, text, text, text, text, integer, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text, text, integer, text, text, text) to authenticated;

-- ───────────── 4. Publicar solo con 18 años ─────────────
create or replace function public.validar_edad_publicacion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rol text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_nacimiento date;
  v_anio int;
begin
  if v_rol not in ('anon', 'authenticated') then
    return new;
  end if;
  if not (tg_op = 'UPDATE' and old.status = 'borrador' and new.status = 'activa') then
    return new;
  end if;

  select v.verified_birth_date into v_nacimiento
  from public.identity_verifications v
  where v.user_id = new.author_id and v.status = 'aprobada'
  order by v.verified_at desc nulls last
  limit 1;

  if v_nacimiento is not null then
    if v_nacimiento > (current_date - interval '18 years')::date then
      raise exception 'REQ_EDAD' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Sin fecha del documento: se usa el año declarado (18 cumplidos seguro = 19 de diferencia)
  select birth_year into v_anio from public.profile_private where id = new.author_id;
  if v_anio is null or extract(year from now())::int - v_anio < 19 then
    raise exception 'REQ_EDAD' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.validar_edad_publicacion() from public, anon, authenticated;

drop trigger if exists causes_validar_edad_publicacion on public.causes;
create trigger causes_validar_edad_publicacion
  before update on public.causes
  for each row execute function public.validar_edad_publicacion();

-- ───────────── 5. Foto de perfil: rutas internas solo para cuentas oficiales ─────────────
create or replace function public.bloquear_avatar_interno()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_rol text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if new.avatar_url is distinct from old.avatar_url
     and new.avatar_url like '/%'
     and v_rol in ('anon', 'authenticated') then
    raise exception 'AVATAR_NO_PERMITIDO' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.bloquear_avatar_interno() from public, anon, authenticated;

drop trigger if exists profiles_bloquear_avatar_interno on public.profiles;
create trigger profiles_bloquear_avatar_interno
  before update of avatar_url on public.profiles
  for each row execute function public.bloquear_avatar_interno();

-- ───────────── 6. Causas de ejemplo: fuera de conteos; ya no se crean por usuario ─────────────
create or replace view public.country_cause_counts
with (security_invoker = true) as
select country_code, count(*)::integer as active_count
from public.causes
where status = 'activa' and country_code is not null and not is_example
group by country_code;

revoke execute on function public.create_example_cause() from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.country_cause_counts from anon, authenticated;
