-- AJUSTES-BUGS-3 · get_advisors (seguridad).
-- Funciones de trigger: nadie debe llamarlas por RPC.
revoke execute on function public.enforce_cause_status() from public, anon, authenticated;
revoke execute on function public.handle_cause_status_activity() from public, anon, authenticated;
revoke execute on function public.handle_comment_counts() from public, anon, authenticated;
revoke execute on function public.handle_follow_counts() from public, anon, authenticated;
revoke execute on function public.handle_save_counts() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Solo con sesión: create_example_cause (Mis causas) e is_onboarded (políticas de INSERT de authenticated).
revoke execute on function public.create_example_cause() from public, anon;
grant execute on function public.create_example_cause() to authenticated;
revoke execute on function public.is_onboarded() from public, anon;
grant execute on function public.is_onboarded() to authenticated;

-- TRUNCATE salta RLS: ningún rol del cliente lo necesita.
do $$
declare r record;
begin
  for r in select c.relname from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  loop
    execute format('revoke truncate on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;
