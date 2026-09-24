-- AJUSTES-BUGS-3 · Sección 5.3: RLS activa y forzada en donation_methods.
-- La dueña de la tabla (postgres) tiene BYPASSRLS, así que las funciones
-- SECURITY DEFINER (enforce_cause_status, create_example_cause) no cambian.
-- anon sigue sin privilegios sobre la tabla (segunda barrera, ver 000500).
alter table public.donation_methods force row level security;
