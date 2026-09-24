-- AJUSTES-BUGS-3 · Sección 3 (comentarios) y 5.5 (contadores).

-- 1. Lectura pública de comentarios cuando la causa es visible, con o sin sesión.
grant select on public.comments to anon, authenticated;
grant select on public.causes to anon, authenticated;
grant select on public.profiles to anon, authenticated;

drop policy if exists "comments_select_visible" on public.comments;
create policy "comments_select_visible" on public.comments
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.causes c
      where c.id = comments.cause_id
        and (c.status in ('activa', 'cerrada', 'finalizada') or c.author_id = (select auth.uid()))
    )
  );

-- 2. Escritura solo con sesión: comentar, editar el propio, borrar el propio
--    (o cualquiera si es la autora de la causa).
grant insert, delete on public.comments to authenticated;
revoke update on public.comments from anon, authenticated;
grant update (body) on public.comments to authenticated;

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.onboarding_completed_at is not null)
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "comments_delete_own_or_cause_author" on public.comments;
create policy "comments_delete_own_or_cause_author" on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.causes c
               where c.id = comments.cause_id and c.author_id = (select auth.uid()))
  );

-- 3. Contadores. Solo se crea el trigger si no existe ya uno que mantenga
--    ese contador, para no contar doble. Después se recalculan con la realidad.

create or replace function public.trg_comments_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.causes set comments_count = comments_count + 1 where id = new.cause_id;
    return new;
  else
    update public.causes set comments_count = greatest(comments_count - 1, 0) where id = old.cause_id;
    return old;
  end if;
end $$;

create or replace function public.trg_replies_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      update public.comments set replies_count = replies_count + 1 where id = new.parent_id;
    end if;
    return new;
  else
    if old.parent_id is not null then
      update public.comments set replies_count = greatest(replies_count - 1, 0) where id = old.parent_id;
    end if;
    return old;
  end if;
end $$;

create or replace function public.trg_saves_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.causes set saves_count = saves_count + 1 where id = new.cause_id;
    return new;
  else
    update public.causes set saves_count = greatest(saves_count - 1, 0) where id = old.cause_id;
    return old;
  end if;
end $$;

create or replace function public.trg_follows_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    return new;
  else
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
end $$;

create or replace function public.trg_causes_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'borrador' then
      update public.profiles set causes_count = causes_count + 1 where id = new.author_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status <> 'borrador' then
      update public.profiles set causes_count = greatest(causes_count - 1, 0) where id = old.author_id;
    end if;
    return old;
  else
    if old.status = 'borrador' and new.status <> 'borrador' then
      update public.profiles set causes_count = causes_count + 1 where id = new.author_id;
    end if;
    return new;
  end if;
end $$;

do $$
declare
  -- ¿Hay ya un trigger (distinto del nuestro) en la tabla cuya función mantiene la columna?
  function_exists boolean;
begin
  -- comments_count (en comments → causes)
  select exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.comments'::regclass and not t.tgisinternal
      and p.prosrc ilike '%comments_count%' and p.proname <> 'trg_comments_count'
  ) into function_exists;
  if not function_exists then
    drop trigger if exists comments_count_trg on public.comments;
    create trigger comments_count_trg after insert or delete on public.comments
      for each row execute function public.trg_comments_count();
  end if;

  -- replies_count (en comments → comments)
  select exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.comments'::regclass and not t.tgisinternal
      and p.prosrc ilike '%replies_count%' and p.proname <> 'trg_replies_count'
  ) into function_exists;
  if not function_exists then
    drop trigger if exists replies_count_trg on public.comments;
    create trigger replies_count_trg after insert or delete on public.comments
      for each row execute function public.trg_replies_count();
  end if;

  -- saves_count (en saves → causes)
  select exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.saves'::regclass and not t.tgisinternal
      and p.prosrc ilike '%saves_count%' and p.proname <> 'trg_saves_count'
  ) into function_exists;
  if not function_exists then
    drop trigger if exists saves_count_trg on public.saves;
    create trigger saves_count_trg after insert or delete on public.saves
      for each row execute function public.trg_saves_count();
  end if;

  -- followers_count / following_count (en follows → profiles)
  select exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.follows'::regclass and not t.tgisinternal
      and p.prosrc ilike '%followers_count%' and p.proname <> 'trg_follows_count'
  ) into function_exists;
  if not function_exists then
    drop trigger if exists follows_count_trg on public.follows;
    create trigger follows_count_trg after insert or delete on public.follows
      for each row execute function public.trg_follows_count();
  end if;

  -- causes_count (en causes → profiles)
  select exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.causes'::regclass and not t.tgisinternal
      and p.prosrc ilike '%causes_count%' and p.proname <> 'trg_causes_count'
  ) into function_exists;
  if not function_exists then
    drop trigger if exists causes_count_trg on public.causes;
    create trigger causes_count_trg after insert or delete or update of status on public.causes
      for each row execute function public.trg_causes_count();
  end if;
end $$;

-- Que los contadores cuadren con la realidad.
update public.causes c
   set comments_count = s.n
  from (select c2.id, (select count(*) from public.comments m where m.cause_id = c2.id)::int as n
          from public.causes c2) s
 where s.id = c.id and c.comments_count is distinct from s.n;

update public.comments c
   set replies_count = s.n
  from (select c2.id, (select count(*) from public.comments r where r.parent_id = c2.id)::int as n
          from public.comments c2) s
 where s.id = c.id and c.replies_count is distinct from s.n;

update public.causes c
   set saves_count = s.n
  from (select c2.id, (select count(*) from public.saves v where v.cause_id = c2.id)::int as n
          from public.causes c2) s
 where s.id = c.id and c.saves_count is distinct from s.n;

update public.profiles p
   set followers_count = s.fers, following_count = s.fing, causes_count = s.nc
  from (select p2.id,
               (select count(*) from public.follows f where f.following_id = p2.id)::int as fers,
               (select count(*) from public.follows f where f.follower_id = p2.id)::int as fing,
               (select count(*) from public.causes c where c.author_id = p2.id and c.status <> 'borrador')::int as nc
          from public.profiles p2) s
 where s.id = p.id
   and (p.followers_count, p.following_count, p.causes_count) is distinct from (s.fers, s.fing, s.nc);
