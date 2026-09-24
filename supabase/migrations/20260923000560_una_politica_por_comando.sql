-- Consolidación: una sola política permisiva por tabla y comando (auditoría de políticas que se pisan).
-- Con dos permisivas, el acceso es la suma de ambas; aquí queda solo la correcta.

-- 1. Se eliminan las duplicadas o más laxas (12).
drop policy if exists "causes_insert_author" on public.causes;               -- sin is_onboarded()
drop policy if exists "causes_update_author" on public.causes;               -- idéntica a causes_update_own
drop policy if exists "causes_delete_author_borrador" on public.causes;      -- subconjunto de "eliminar mi causa sin apoyo"
drop policy if exists "comments_select" on public.comments;                  -- idéntica a comments_select_visible
drop policy if exists "comments_insert_own" on public.comments;              -- equivalente a comments_insert
drop policy if exists "comments_update" on public.comments;                  -- idéntica a comments_update_own
drop policy if exists "comments_delete" on public.comments;                  -- idéntica a comments_delete_own_or_cause_author
drop policy if exists "cause_supplies_write_author" on public.cause_supplies; -- permitía cerradas/finalizadas
drop policy if exists "cause_media_update_author" on public.cause_media;     -- idéntica a cause_media_update
drop policy if exists "donation_methods_write_author" on public.donation_methods; -- INSERT sin onboarding
drop policy if exists "follows_select" on public.follows;                    -- idéntica a follows_select_all
drop policy if exists "editar mis datos privados" on public.profile_private; -- rol public; queda la de authenticated

-- 2. causes · DELETE: borrador siempre; activa mientras no tenga apoyo confirmado; nunca cerrada ni finalizada.
alter policy "eliminar mi causa sin apoyo" on public.causes
  using (
    author_id = (select auth.uid())
    and (status = 'borrador'
         or (status = 'activa' and first_support_confirmed_at is null))
  );

-- 3. donation_methods · DELETE: el método es tuyo y la causa es tuya y está en borrador/activa.
alter policy "donation_methods_delete" on public.donation_methods
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.causes c
                where c.id = donation_methods.cause_id
                  and c.author_id = (select auth.uid())
                  and c.status in ('borrador', 'activa'))
  );
