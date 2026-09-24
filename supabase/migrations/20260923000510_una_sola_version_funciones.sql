-- AJUSTES-BUGS-3 · Sección 5.4: una sola versión de cada función.
-- - complete_onboarding: queda solo la de 3 parámetros (p_full_name, p_phone, p_terms_version).
-- - trg_*_count: los creó 000400 como respaldo, pero la base ya tenía triggers de
--   contadores (handle_comment_counts, handle_save_counts, handle_follow_counts,
--   handle_cause_status_activity), así que ningún trigger los usa.
drop function if exists public.complete_onboarding(text, text, text, text);
drop function if exists public.trg_comments_count();
drop function if exists public.trg_replies_count();
drop function if exists public.trg_saves_count();
drop function if exists public.trg_follows_count();
drop function if exists public.trg_causes_count();
