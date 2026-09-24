-- AJUSTES-BUGS-4 · Migración 015: apoyos y comentarios.
--   1. confirm_support -> security definer con verificaciones; causes con permisos por columna.
--   2. support_reports: tipos, tabla, índices, políticas, antispam y validaciones.
--   3. confirmar_aviso / rechazar_aviso / apoyos_confirmados.
--   4. comment_media con sus políticas y máximo 2 por comentario.
--   5. comments: ventana de una hora para editar/borrar (políticas + trigger).
--   6. set_updated_at en support_reports.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. confirm_support y permisos de causes
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.confirm_support(
  p_cause_id uuid,
  p_amount numeric default null,
  p_supplies jsonb default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'SIN_SESION' using errcode = 'P0001';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'MONTO_INVALIDO' using errcode = 'P0001';
  end if;

  -- Solo la autora, y solo en activa o cerrada. El total se escribe completo (no se suma).
  update public.causes
     set raised_reported = coalesce(p_amount, raised_reported),
         first_support_confirmed_at = coalesce(first_support_confirmed_at, now())
   where id = p_cause_id
     and author_id = v_uid
     and status in ('activa', 'cerrada');
  if not found then
    raise exception 'CAUSA_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if p_supplies is not null then
    update public.cause_supplies s
       set quantity_received = greatest((e->>'received')::numeric, 0)
      from jsonb_array_elements(p_supplies) e
     where s.id = (e->>'id')::uuid
       and s.cause_id = p_cause_id;
  end if;
end $$;

revoke execute on function public.confirm_support(uuid, numeric, jsonb) from public, anon;
grant execute on function public.confirm_support(uuid, numeric, jsonb) to authenticated;

-- causes: solo columnas de contenido. first_support_confirmed_at, contadores, fechas de
-- estado, is_example y author_id los escriben triggers y funciones, nunca el cliente.
revoke update on public.causes from anon, authenticated;
grant update (status, title, description, category, country_code, city, region, lat, lng,
              goal_amount, currency, raised_reported, closing_note, collection_type,
              supplies_instructions)
  on public.causes to authenticated;

revoke insert on public.causes from anon, authenticated;
grant insert (author_id, status, title, description, category, country_code, city, region,
              lat, lng, goal_amount, currency, collection_type, supplies_instructions)
  on public.causes to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. support_reports
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_kind' and typnamespace = 'public'::regnamespace) then
    create type public.support_kind as enum ('dinero', 'insumos');
  end if;
  if not exists (select 1 from pg_type where typname = 'support_status' and typnamespace = 'public'::regnamespace) then
    create type public.support_status as enum ('reportado', 'confirmado', 'no_recibido');
  end if;
end $$;

create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  cause_id uuid not null references public.causes(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  kind public.support_kind not null,
  amount numeric(12,2) check (amount is null or amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  items jsonb,                                   -- [{ "supply_id": "...", "quantity": 5 }]
  message text check (message is null or char_length(message) <= 500),
  is_anonymous boolean not null default false,
  status public.support_status not null default 'reportado',
  thanks_message text check (thanks_message is null or char_length(thanks_message) <= 500),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint aviso_coherente check (
    (kind = 'dinero'  and amount is not null) or
    (kind = 'insumos' and items is not null)
  )
);
create index if not exists support_reports_cause_status_idx on public.support_reports (cause_id, status, created_at desc);
create index if not exists support_reports_donor_idx on public.support_reports (donor_id, created_at desc);

alter table public.support_reports enable row level security;

revoke all on public.support_reports from anon, authenticated;
grant select on public.support_reports to anon, authenticated;
grant insert (cause_id, donor_id, kind, amount, currency, items, message, is_anonymous)
  on public.support_reports to authenticated;
grant delete on public.support_reports to authenticated;
-- update: ningún permiso; los cambios de estado pasan por confirmar_aviso / rechazar_aviso.

-- select: quien avisó, la autora de la causa, y cualquiera si está confirmado, la causa es
-- visible y NO es anónimo (los anónimos se publican por apoyos_confirmados(), sin donor_id).
drop policy if exists "support_reports_select" on public.support_reports;
create policy "support_reports_select" on public.support_reports
  for select to anon, authenticated
  using (
    donor_id = (select auth.uid())
    or exists (select 1 from public.causes c
               where c.id = support_reports.cause_id and c.author_id = (select auth.uid()))
    or (status = 'confirmado'
        and not is_anonymous
        and exists (select 1 from public.causes c
                    where c.id = support_reports.cause_id
                      and c.status in ('activa', 'cerrada', 'finalizada')))
  );

drop policy if exists "support_reports_insert" on public.support_reports;
create policy "support_reports_insert" on public.support_reports
  for insert to authenticated
  with check (
    donor_id = (select auth.uid())
    and (select public.is_onboarded())
    and exists (select 1 from public.causes c
                where c.id = support_reports.cause_id
                  and c.status = 'activa'
                  and c.author_id <> (select auth.uid()))
  );

drop policy if exists "support_reports_delete" on public.support_reports;
create policy "support_reports_delete" on public.support_reports
  for delete to authenticated
  using (donor_id = (select auth.uid()) and status = 'reportado');

-- Antispam y coherencia con la causa (respaldo de la política, con mensajes claros).
create or replace function public.support_reports_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_cause record;
  v_item jsonb;
begin
  select id, author_id, status, collection_type, currency into v_cause
    from public.causes where id = new.cause_id;
  if v_cause.id is null or v_cause.status <> 'activa' then
    raise exception 'CAUSA_NO_ACTIVA' using errcode = 'P0001';
  end if;
  if v_cause.author_id = new.donor_id then
    raise exception 'AUTOAPOYO' using errcode = 'P0001';
  end if;

  if (select count(*) from public.support_reports
       where donor_id = new.donor_id and cause_id = new.cause_id
         and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'LIMITE_AVISOS' using errcode = 'P0001';
  end if;

  if new.kind = 'dinero' then
    if v_cause.collection_type not in ('dinero', 'ambas') then
      raise exception 'TIPO_NO_ADMITIDO' using errcode = 'P0001';
    end if;
    -- Se suma al total de la causa: tiene que estar en su moneda.
    new.currency := v_cause.currency;
    new.items := null;
  else
    if v_cause.collection_type not in ('insumos', 'ambas') then
      raise exception 'TIPO_NO_ADMITIDO' using errcode = 'P0001';
    end if;
    if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then
      raise exception 'ITEMS_INVALIDOS' using errcode = 'P0001';
    end if;
    for v_item in select * from jsonb_array_elements(new.items) loop
      if not exists (select 1 from public.cause_supplies s
                     where s.id = (v_item->>'supply_id')::uuid and s.cause_id = new.cause_id)
         or coalesce((v_item->>'quantity')::numeric, 0) <= 0 then
        raise exception 'ITEMS_INVALIDOS' using errcode = 'P0001';
      end if;
    end loop;
    new.amount := null;
  end if;

  new.status := 'reportado';
  new.thanks_message := null;
  new.confirmed_at := null;
  return new;
end $$;

drop trigger if exists support_reports_before_insert on public.support_reports;
create trigger support_reports_before_insert
  before insert on public.support_reports
  for each row execute function public.support_reports_before_insert();

drop trigger if exists set_updated_at_support_reports on public.support_reports;
create trigger set_updated_at_support_reports
  before update on public.support_reports
  for each row execute function public.handle_updated_at();

revoke execute on function public.support_reports_before_insert() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Funciones de la autora y lectura pública
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.confirmar_aviso(p_report_id uuid, p_thanks text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_report public.support_reports%rowtype;
  v_author uuid;
  v_item jsonb;
begin
  if v_uid is null then
    raise exception 'SIN_SESION' using errcode = 'P0001';
  end if;

  select * into v_report from public.support_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'AVISO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;
  select author_id into v_author from public.causes where id = v_report.cause_id for update;
  if v_author is distinct from v_uid then
    raise exception 'NO_ES_TU_CAUSA' using errcode = 'P0001';
  end if;
  if v_report.status <> 'reportado' then
    raise exception 'AVISO_YA_RESUELTO' using errcode = 'P0001';
  end if;
  if p_thanks is not null and char_length(p_thanks) > 500 then
    raise exception 'AGRADECIMIENTO_LARGO' using errcode = 'P0001';
  end if;

  update public.support_reports
     set status = 'confirmado',
         confirmed_at = now(),
         thanks_message = nullif(btrim(coalesce(p_thanks, '')), '')
   where id = p_report_id;

  if v_report.kind = 'dinero' then
    update public.causes
       set raised_reported = coalesce(raised_reported, 0) + v_report.amount
     where id = v_report.cause_id;
  else
    for v_item in select * from jsonb_array_elements(v_report.items) loop
      update public.cause_supplies s
         set quantity_received = case
               when s.quantity_needed is not null
                 then greatest(s.quantity_received,
                               least(s.quantity_received + (v_item->>'quantity')::numeric, s.quantity_needed))
               else s.quantity_received + (v_item->>'quantity')::numeric
             end
       where s.id = (v_item->>'supply_id')::uuid
         and s.cause_id = v_report.cause_id;
    end loop;
  end if;

  update public.causes
     set first_support_confirmed_at = coalesce(first_support_confirmed_at, now())
   where id = v_report.cause_id;
end $$;

create or replace function public.rechazar_aviso(p_report_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_report public.support_reports%rowtype;
  v_author uuid;
begin
  if v_uid is null then
    raise exception 'SIN_SESION' using errcode = 'P0001';
  end if;

  select * into v_report from public.support_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'AVISO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;
  select author_id into v_author from public.causes where id = v_report.cause_id;
  if v_author is distinct from v_uid then
    raise exception 'NO_ES_TU_CAUSA' using errcode = 'P0001';
  end if;
  if v_report.status <> 'reportado' then
    raise exception 'AVISO_YA_RESUELTO' using errcode = 'P0001';
  end if;

  update public.support_reports set status = 'no_recibido' where id = p_report_id;
end $$;

-- Sección pública "Apoyos confirmados": oculta quién donó cuando el aviso es anónimo.
create or replace function public.apoyos_confirmados(p_cause_id uuid)
returns table (
  id uuid,
  kind public.support_kind,
  amount numeric,
  currency text,
  items jsonb,
  message text,
  thanks_message text,
  confirmed_at timestamptz,
  is_anonymous boolean,
  donor_name text,
  donor_public_id text,
  donor_avatar_url text
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.kind, r.amount, r.currency, r.items, r.message, r.thanks_message, r.confirmed_at,
         r.is_anonymous,
         case when r.is_anonymous then null else p.full_name end,
         case when r.is_anonymous then null else p.public_id end,
         case when r.is_anonymous then null else p.avatar_url end
    from public.support_reports r
    join public.causes c on c.id = r.cause_id
    join public.profiles p on p.id = r.donor_id
   where r.cause_id = p_cause_id
     and r.status = 'confirmado'
     and c.status in ('activa', 'cerrada', 'finalizada')
   order by r.confirmed_at desc;
$$;

revoke execute on function public.confirmar_aviso(uuid, text) from public, anon;
grant execute on function public.confirmar_aviso(uuid, text) to authenticated;
revoke execute on function public.rechazar_aviso(uuid) from public, anon;
grant execute on function public.rechazar_aviso(uuid) to authenticated;
revoke execute on function public.apoyos_confirmados(uuid) from public;
grant execute on function public.apoyos_confirmados(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. comment_media
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.comment_media (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null default 'causas-imagenes' check (bucket = 'causas-imagenes'),
  storage_path text not null unique,
  width int, height int, bytes int,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists comment_media_comment_idx on public.comment_media (comment_id, position);
create index if not exists comment_media_owner_idx on public.comment_media (owner_id);
alter table public.comment_media enable row level security;

revoke all on public.comment_media from anon, authenticated;
grant select on public.comment_media to anon, authenticated;
grant insert (comment_id, owner_id, storage_path, width, height, bytes, position)
  on public.comment_media to authenticated;
grant delete on public.comment_media to authenticated;

drop policy if exists "comment_media_select" on public.comment_media;
create policy "comment_media_select" on public.comment_media
  for select to anon, authenticated
  using (
    exists (select 1 from public.comments m
              join public.causes c on c.id = m.cause_id
             where m.id = comment_media.comment_id
               and (c.status in ('activa', 'cerrada', 'finalizada') or c.author_id = (select auth.uid())))
  );

-- Solo la dueña, dentro de la hora del comentario y en su carpeta {uid}/comentarios/{comment_id}/.
drop policy if exists "comment_media_insert" on public.comment_media;
create policy "comment_media_insert" on public.comment_media
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and storage_path like ((select auth.uid())::text || '/comentarios/' || comment_id::text || '/%')
    and exists (select 1 from public.comments m
                where m.id = comment_media.comment_id
                  and m.author_id = (select auth.uid())
                  and m.created_at > now() - interval '1 hour')
  );

drop policy if exists "comment_media_delete" on public.comment_media;
create policy "comment_media_delete" on public.comment_media
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.comments m
                where m.id = comment_media.comment_id
                  and m.created_at > now() - interval '1 hour')
  );

create or replace function public.comment_media_max_two()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.comment_media where comment_id = new.comment_id) >= 2 then
    raise exception 'MAX_FOTOS_COMENTARIO' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.comment_media_max_two() from public, anon, authenticated;

drop trigger if exists comment_media_max_two on public.comment_media;
create trigger comment_media_max_two
  before insert on public.comment_media
  for each row execute function public.comment_media_max_two();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. comments: una hora para editar o borrar
-- ─────────────────────────────────────────────────────────────────────────────
alter policy "comments_update_own" on public.comments
  using (author_id = (select auth.uid()) and created_at > now() - interval '1 hour')
  with check (author_id = (select auth.uid()) and created_at > now() - interval '1 hour');

alter policy "comments_delete_own_or_cause_author" on public.comments
  using (
    (author_id = (select auth.uid()) and created_at > now() - interval '1 hour')
    or exists (select 1 from public.causes c
               where c.id = comments.cause_id and c.author_id = (select auth.uid()))
  );

-- Respaldo de la regla fuera de las políticas. Deja pasar: borrados en cascada
-- (pg_trigger_depth() > 1), llamadas sin sesión (servicio) y cambios que no tocan el
-- texto (contadores de respuestas).
create or replace function public.enforce_comment_window()
returns trigger language plpgsql set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    if new.body is distinct from old.body
       and (old.author_id <> v_uid or old.created_at <= now() - interval '1 hour') then
      raise exception 'VENTANA_CERRADA' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- DELETE: la autora de la causa puede siempre; quien comentó, solo dentro de la hora.
  if exists (select 1 from public.causes c where c.id = old.cause_id and c.author_id = v_uid) then
    return old;
  end if;
  if old.author_id <> v_uid or old.created_at <= now() - interval '1 hour' then
    raise exception 'VENTANA_CERRADA' using errcode = 'P0001';
  end if;
  return old;
end $$;
revoke execute on function public.enforce_comment_window() from public, anon, authenticated;

drop trigger if exists comments_enforce_window on public.comments;
create trigger comments_enforce_window
  before update or delete on public.comments
  for each row execute function public.enforce_comment_window();
