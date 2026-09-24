-- get_advisors · auth_rls_initplan: auth.uid() envuelto en (select auth.uid()).
-- No cambia quién ve qué; solo evita evaluarlo fila por fila.
alter policy "editar mis datos privados" on public.profile_private
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "causes_select_visible" on public.causes
  using ((status = any (array['activa'::public.cause_status, 'cerrada'::public.cause_status, 'finalizada'::public.cause_status]))
         or (author_id = (select auth.uid())));

alter policy "cause_media_select_visible" on public.cause_media
  using (exists (select 1 from public.causes c
                 where c.id = cause_media.cause_id
                   and ((c.status = any (array['activa'::public.cause_status, 'cerrada'::public.cause_status, 'finalizada'::public.cause_status]))
                        or (c.author_id = (select auth.uid())))));

alter policy "ver insumos de causas visibles" on public.cause_supplies
  using (exists (select 1 from public.causes c
                 where c.id = cause_supplies.cause_id
                   and ((c.status = any (array['activa'::public.cause_status, 'cerrada'::public.cause_status, 'finalizada'::public.cause_status]))
                        or (c.author_id = (select auth.uid())))));

alter policy "cause_results_select" on public.cause_results
  using (exists (select 1 from public.causes c
                 where c.id = cause_results.cause_id
                   and ((c.status = any (array['activa'::public.cause_status, 'cerrada'::public.cause_status, 'finalizada'::public.cause_status]))
                        or (c.author_id = (select auth.uid())))));
