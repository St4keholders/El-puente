-- AJUSTES-BUGS-3 · Sección 2 (parte A): ID público PNT-XXXXXX.
-- Aplicar ANTES de desplegar el código nuevo. La parte B
-- (20260923000600_014b_eliminar_username.sql) se aplica DESPUÉS del despliegue.

-- Generador: 6 caracteres sin letras confundibles (sin O, 0, I, 1, L).
create or replace function public.gen_public_id()
returns text language sql volatile set search_path = '' as $$
  select 'PNT-' || string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1), ''
  ) from generate_series(1, 6);
$$;

alter table public.profiles add column if not exists public_id text;

-- Relleno con reintento por si hay colisión.
do $$
declare r record; nuevo text;
begin
  for r in select id from public.profiles where public_id is null loop
    loop
      nuevo := public.gen_public_id();
      exit when not exists (select 1 from public.profiles where public_id = nuevo);
    end loop;
    update public.profiles set public_id = nuevo where id = r.id;
  end loop;
end $$;

create unique index if not exists profiles_public_id_key on public.profiles (public_id);
alter table public.profiles alter column public_id set not null;
alter table public.profiles alter column public_id set default public.gen_public_id();

-- El ID nunca se edita (no está en ningún grant update y además lo bloquea este trigger).
create or replace function public.profiles_public_id_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.public_id is distinct from old.public_id then
    raise exception 'ID_INMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_public_id_inmutable on public.profiles;
create trigger profiles_public_id_inmutable
  before update on public.profiles
  for each row execute function public.profiles_public_id_inmutable();

-- Mientras se despliega el código nuevo, username deja de ser obligatorio
-- (handle_new_user ya no lo inventa). La parte B borra la columna.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'username') then
    alter table public.profiles alter column username drop not null;
  end if;
end $$;

-- Alta de usuario: perfil con el nombre de Google y su fila privada. El ID lo pone el default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 80),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;

  insert into public.profile_private (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass and p.proname = 'handle_new_user' and not t.tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users for each row execute function public.handle_new_user();
  end if;
end $$;

-- Registro: una sola versión con tres parámetros (la parte B borra las anteriores).
drop function if exists public.complete_onboarding(text, text, text);
create function public.complete_onboarding(
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

  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
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
    set phone = coalesce(excluded.phone, public.profile_private.phone),
        terms_version = excluded.terms_version,
        terms_accepted_at = excluded.terms_accepted_at;
end $$;

revoke execute on function public.complete_onboarding(text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text) to authenticated;

-- Buscador: personas por nombre o por ID público, causas activas por título.
drop function if exists public.search_people_and_causes(text, integer);

create function public.search_people_and_causes(q text, max_results integer default 8)
returns table (
  kind text,
  id uuid,
  label text,
  sublabel text,
  public_id text,
  country_code text,
  lat double precision,
  lng double precision,
  score integer
)
language sql stable set search_path = '' as $$
  with t as (
    select public.f_unaccent(lower(btrim(q))) as nq,
           upper(btrim(q)) as uq
  )
  (
    select 'persona'::text,
           p.id,
           p.full_name,
           concat_ws(' · ', p.public_id, p.city),
           p.public_id,
           p.country_code,
           null::double precision,
           null::double precision,
           case
             when p.public_id in (t.uq, 'PNT-' || t.uq) then 3
             when public.f_unaccent(lower(p.full_name)) like public.escape_like(t.nq) || '%' then 2
             else 1
           end
      from public.profiles p, t
     where char_length(t.nq) >= 2
       and p.onboarding_completed_at is not null
       and (
         p.public_id in (t.uq, 'PNT-' || t.uq)
         or public.f_unaccent(lower(p.full_name)) like '%' || public.escape_like(t.nq) || '%'
       )
     order by 9 desc, p.full_name
     limit max_results
  )
  union all
  (
    select 'causa'::text,
           c.id,
           c.title,
           concat_ws(', ', c.city, c.country_code),
           null::text,
           c.country_code,
           c.lat::double precision,
           c.lng::double precision,
           case
             when public.f_unaccent(lower(c.title)) like public.escape_like(t.nq) || '%' then 2
             else 1
           end
      from public.causes c, t
     where char_length(t.nq) >= 2
       and c.status = 'activa'
       and c.title is not null
       and public.f_unaccent(lower(c.title)) like '%' || public.escape_like(t.nq) || '%'
     order by 9 desc, c.published_at desc
     limit max_results
  )
$$;

grant execute on function public.search_people_and_causes(text, integer) to anon, authenticated;
