-- AJUSTES-BUGS-3 · Sección 4: el borrador de la causa no se guardaba.
--
-- El guardado automático manda una fila completa en cada cambio. Cualquier
-- restricción que rechace un valor intermedio (cadena vacía, 0, columna sin
-- permiso) tumba el UPDATE entero. Aquí se relajan las restricciones de
-- borrador y se asegura que la autora puede escribir todo lo que toca el
-- asistente. Los mínimos para publicar los sigue validando el trigger de
-- activación (REQ_*).

-- 1. Instrucciones de entrega: el mínimo de 20 solo aplica al publicar.
alter table public.causes drop constraint if exists causes_supplies_instructions_check;
alter table public.causes add constraint causes_supplies_instructions_check
  check (supplies_instructions is null or char_length(supplies_instructions) <= 600);

-- 2. Meta: vacío = null; si existe debe ser positiva.
alter table public.causes drop constraint if exists causes_goal_amount_check;
alter table public.causes add constraint causes_goal_amount_check
  check (goal_amount is null or goal_amount > 0);

-- 3. Permisos por columna de todo lo que toca el borrador.
grant insert (author_id, status, title, description, category, country_code, city, region,
              lat, lng, goal_amount, currency, collection_type, supplies_instructions)
  on public.causes to authenticated;
grant update (status, title, description, category, country_code, city, region, lat, lng,
              goal_amount, currency, raised_reported, closing_note, collection_type,
              supplies_instructions)
  on public.causes to authenticated;

grant select, insert, update, delete on public.donation_methods to authenticated;
grant select, insert, update, delete on public.cause_supplies to authenticated;
grant select, insert, update, delete on public.cause_media to authenticated;

-- 4. RLS: la autora edita su causa (el trigger de estado valida transiciones).
drop policy if exists "causes_update_author" on public.causes;
create policy "causes_update_author" on public.causes
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "causes_insert_author" on public.causes;
create policy "causes_insert_author" on public.causes
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'borrador');

drop policy if exists "causes_delete_author_borrador" on public.causes;
create policy "causes_delete_author_borrador" on public.causes
  for delete to authenticated
  using (author_id = (select auth.uid()) and status = 'borrador');

-- 5. Tablas hijas: métodos e insumos de la autora mientras la causa está en borrador o activa.
drop policy if exists "donation_methods_write_author" on public.donation_methods;
create policy "donation_methods_write_author" on public.donation_methods
  for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = donation_methods.cause_id
                  and c.author_id = (select auth.uid())
                  and c.status in ('borrador', 'activa'))
  )
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = donation_methods.cause_id
                  and c.author_id = (select auth.uid())
                  and c.status in ('borrador', 'activa'))
  );

drop policy if exists "cause_supplies_write_author" on public.cause_supplies;
create policy "cause_supplies_write_author" on public.cause_supplies
  for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = cause_supplies.cause_id
                  and c.author_id = (select auth.uid()))
  )
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = cause_supplies.cause_id
                  and c.author_id = (select auth.uid()))
  );

drop policy if exists "cause_media_update_author" on public.cause_media;
create policy "cause_media_update_author" on public.cause_media
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 6. Fecha de publicación: la pone la base al pasar de borrador a activa
--    (el cliente ya no la manda; published_at no está en el grant update).
create or replace function public.causes_set_published_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'borrador' and new.status = 'activa' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists causes_set_published_at on public.causes;
create trigger causes_set_published_at
  before update of status on public.causes
  for each row execute function public.causes_set_published_at();
