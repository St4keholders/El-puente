-- HOTFIX DE SEGURIDAD: impedir mover métodos de donación, fotos e insumos a causas ajenas.
-- Antes: donation_methods_update, cause_media_update(_author) y "actualizar mis insumos"
-- solo exigían owner_id = uid en WITH CHECK, y authenticated podía actualizar cause_id.
-- Un usuario podía poner su cuenta bancaria en la causa activa de otra persona.

-- donation_methods · UPDATE: el método es tuyo, la causa (origen y destino) es tuya y está en borrador/activa,
-- y profile_method_id, si viene, es tuyo.
alter policy "donation_methods_update" on public.donation_methods
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
    and (profile_method_id is null
         or exists (select 1 from public.profile_donation_methods pm
                    where pm.id = donation_methods.profile_method_id
                      and pm.owner_id = (select auth.uid())))
  );

alter policy "donation_methods_write_author" on public.donation_methods
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = donation_methods.cause_id
                  and c.author_id = (select auth.uid())
                  and c.status in ('borrador', 'activa'))
    and (profile_method_id is null
         or exists (select 1 from public.profile_donation_methods pm
                    where pm.id = donation_methods.profile_method_id
                      and pm.owner_id = (select auth.uid())))
  );

-- cause_media · UPDATE: la causa de destino es tuya, con las mismas fases/estados que el INSERT.
alter policy "cause_media_update" on public.cause_media
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = cause_media.cause_id
                  and c.author_id = (select auth.uid())
                  and ((cause_media.phase = 'causa' and c.status in ('borrador', 'activa'))
                       or (cause_media.phase = 'resultado' and c.status = 'cerrada')))
  );

alter policy "cause_media_update_author" on public.cause_media
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = cause_media.cause_id
                  and c.author_id = (select auth.uid())
                  and ((cause_media.phase = 'causa' and c.status in ('borrador', 'activa'))
                       or (cause_media.phase = 'resultado' and c.status = 'cerrada')))
  );

-- cause_supplies · UPDATE: la causa de destino es tuya (borrador, activa o cerrada: confirm_support).
alter policy "actualizar mis insumos" on public.cause_supplies
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = cause_supplies.cause_id
                  and c.author_id = (select auth.uid())
                  and c.status in ('borrador', 'activa', 'cerrada'))
  )
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = cause_supplies.cause_id
                  and c.author_id = (select auth.uid())
                  and c.status in ('borrador', 'activa', 'cerrada'))
  );

-- Segunda barrera: solo columnas de contenido. cause_id y owner_id no se actualizan.
revoke update on public.donation_methods from anon, authenticated;
grant update (kind, provider, account_holder, account_value, details, position, profile_method_id)
  on public.donation_methods to authenticated;

revoke update on public.cause_supplies from anon, authenticated;
grant update (name, unit, quantity_needed, quantity_received, position)
  on public.cause_supplies to authenticated;

revoke update on public.cause_media from anon, authenticated;
grant update (position, alt, is_poster)
  on public.cause_media to authenticated;
