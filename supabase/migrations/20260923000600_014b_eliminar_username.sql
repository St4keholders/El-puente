-- AJUSTES-BUGS-3 · Sección 2 (parte B): eliminar el nombre de usuario.
-- Aplicar DESPUÉS de desplegar el código que ya no usa `username`.
-- Si algo en la base todavía depende de la columna, la migración se aborta
-- entera (es una sola transacción) y dice qué es.

-- 1. Triggers de profiles cuya función valida el usuario, y sus funciones.
do $$
declare r record;
begin
  for r in
    select t.tgname, p.oid::regprocedure as fn
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.profiles'::regclass
       and not t.tgisinternal
       and p.prosrc ilike '%username%'
  loop
    raise notice 'Eliminando trigger % (%)', r.tgname, r.fn;
    execute format('drop trigger %I on public.profiles', r.tgname);
    execute format('drop function if exists %s', r.fn);
  end loop;
end $$;

-- 2. Funciones que sobran: username_available, username_is_valid y todas las
--    versiones viejas de complete_onboarding.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (
         p.proname in ('username_available', 'username_is_valid')
         or (p.proname = 'complete_onboarding'
             and pg_get_function_identity_arguments(p.oid) <> 'p_full_name text, p_phone text, p_terms_version text')
       )
  loop
    raise notice 'Eliminando función %', r.fn;
    execute format('drop function %s', r.fn);
  end loop;
end $$;

-- 3. Ninguna otra función de public puede seguir leyendo username.
do $$
declare refs text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
    into refs
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosrc ~* '\musername\M';
  if refs is not null then
    raise exception 'Estas funciones todavía usan username, actualízalas antes de borrar la columna: %', refs;
  end if;
end $$;

-- 4. Borrar la columna (sin cascade: si una vista o política la usa, falla y avisa).
alter table public.profiles drop column if exists username;

-- 5. Índice de búsqueda por nombre (el anterior incluía username y cae con la columna).
do $$
declare ops_schema text;
begin
  select n.nspname into ops_schema
    from pg_opclass o join pg_namespace n on n.oid = o.opcnamespace
   where o.opcname = 'gin_trgm_ops'
   limit 1;
  if ops_schema is not null then
    execute format(
      'create index if not exists profiles_full_name_trgm on public.profiles using gin (public.f_unaccent(lower(full_name)) %I.gin_trgm_ops)',
      ops_schema
    );
  end if;
end $$;
