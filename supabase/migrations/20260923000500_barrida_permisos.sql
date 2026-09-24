-- AJUSTES-BUGS-3 · Sección 5.3: matriz de lectura.
--   públicos: profiles, causes visibles, cause_media, cause_supplies, cause_results,
--             comments, follows, activity_events, country_cause_counts
--   solo con sesión: donation_methods
--   solo la dueña: profile_private, profile_donation_methods, saves, reports
--
-- Las políticas SELECT que no sean las canónicas se eliminan en las tablas
-- restringidas, para cerrar lo que se haya abierto de más. (Las políticas de
-- escritura no se tocan.)

do $$
declare r record;
begin
  for r in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and cmd = 'SELECT'
       and (
         (tablename = 'donation_methods'
            and policyname not in ('donation_methods_select', 'donation_methods_write_author'))
         or (tablename = 'profile_private' and policyname <> 'ver mis datos privados')
         or (tablename = 'profile_donation_methods' and policyname <> 'profile_donation_methods_select_own')
         or (tablename = 'saves' and policyname <> 'saves_select_own')
         or (tablename = 'reports' and policyname <> 'reports_select_own')
       )
  loop
    raise notice 'Eliminando política de lectura abierta de más: %.%', r.tablename, r.policyname;
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Métodos de donación: nada para anon, ni siquiera a nivel de tabla.
revoke all on public.donation_methods from anon;

drop policy if exists "donation_methods_select" on public.donation_methods;
create policy "donation_methods_select" on public.donation_methods
  for select to authenticated
  using (
    exists (
      select 1 from public.causes c
      where c.id = donation_methods.cause_id
        and (c.status in ('activa', 'cerrada', 'finalizada') or c.author_id = (select auth.uid()))
    )
  );

-- Privadas de la dueña: sin acceso para anon.
revoke all on public.profile_private from anon;
revoke all on public.profile_donation_methods from anon;
revoke all on public.saves from anon;
revoke all on public.reports from anon;

drop policy if exists "ver mis datos privados" on public.profile_private;
create policy "ver mis datos privados" on public.profile_private
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "profile_donation_methods_select_own" on public.profile_donation_methods;
create policy "profile_donation_methods_select_own" on public.profile_donation_methods
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "saves_select_own" on public.saves;
create policy "saves_select_own" on public.saves
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- Escritura de la dueña en profile_private (teléfono desde Mis datos y el asistente).
drop policy if exists "profile_private_insert_own" on public.profile_private;
create policy "profile_private_insert_own" on public.profile_private
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "profile_private_update_own" on public.profile_private;
create policy "profile_private_update_own" on public.profile_private
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
