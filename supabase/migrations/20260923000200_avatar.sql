-- AJUSTES-BUGS-3 · Sección 1: la foto de perfil no cambiaba.
--
-- profiles.avatar_url guarda la ruta dentro del bucket `avatares`
-- ({uid}/avatar-{timestamp}.webp) o una URL http(s) (foto de Google).
-- La persona solo puede editar sus columnas de contenido; el resto
-- (contadores, public_id, onboarding) lo tocan triggers y funciones
-- security definer.

revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, bio, country_code, city) on public.profiles to authenticated;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Bucket de avatares: público para lectura, solo WebP/JPEG/PNG, 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada persona escribe y borra solo dentro de su carpeta {uid}/.
-- (El borrado de la API de Storage necesita también poder leer la fila.)
drop policy if exists "avatares_select_propio" on storage.objects;
create policy "avatares_select_propio" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "avatares_insert_propio" on storage.objects;
create policy "avatares_insert_propio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares'
              and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "avatares_update_propio" on storage.objects;
create policy "avatares_update_propio" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatares'
              and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "avatares_delete_propio" on storage.objects;
create policy "avatares_delete_propio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid()::text));
