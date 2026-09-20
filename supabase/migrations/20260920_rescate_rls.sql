-- PLAN-RESCATE.md Paso 5: Matriz de lectura pública y privacidad

-- 1. profiles (Todos)
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

-- 2. causes (Todos si status no es borrador ni oculta, autora ve las suyas siempre)
DROP POLICY IF EXISTS "causes_read_all" ON public.causes;
DROP POLICY IF EXISTS "causes_select_visible" ON public.causes;
CREATE POLICY "causes_select_visible" ON public.causes FOR SELECT USING (
  (status IN ('activa', 'cerrada', 'finalizada')) OR (author_id = auth.uid())
);

-- 3. cause_media (Todos si su causa es visible)
DROP POLICY IF EXISTS "cause_media_read_all" ON public.cause_media;
DROP POLICY IF EXISTS "cause_media_select_visible" ON public.cause_media;
CREATE POLICY "cause_media_select_visible" ON public.cause_media FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.causes c
    WHERE c.id = cause_media.cause_id
      AND (c.status IN ('activa', 'cerrada', 'finalizada') OR c.author_id = auth.uid())
  )
);

-- 4. cause_supplies (Todos si su causa es visible)
DROP POLICY IF EXISTS "cause_supplies_read_all" ON public.cause_supplies;
DROP POLICY IF EXISTS "ver insumos de causas visibles" ON public.cause_supplies;
CREATE POLICY "ver insumos de causas visibles" ON public.cause_supplies FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.causes c
    WHERE c.id = cause_supplies.cause_id
      AND (c.status IN ('activa', 'cerrada', 'finalizada') OR c.author_id = auth.uid())
  )
);

-- 5. cause_results (Todos si su causa es visible)
DROP POLICY IF EXISTS "cause_results_read_all" ON public.cause_results;
DROP POLICY IF EXISTS "cause_results_select" ON public.cause_results;
CREATE POLICY "cause_results_select" ON public.cause_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.causes c
    WHERE c.id = cause_results.cause_id
      AND (c.status IN ('activa', 'cerrada', 'finalizada') OR c.author_id = auth.uid())
  )
);

-- 6. comments (Todos si su causa es visible)
DROP POLICY IF EXISTS "comments_select_visible" ON public.comments;
CREATE POLICY "comments_select_visible" ON public.comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.causes c
    WHERE c.id = comments.cause_id
      AND (c.status IN ('activa', 'cerrada', 'finalizada') OR c.author_id = auth.uid())
  )
);

-- 7. follows (Todos)
DROP POLICY IF EXISTS "follows_select_all" ON public.follows;
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);

-- 8. donation_methods (Solo con sesión iniciada y si su causa es visible)
ALTER TABLE public.donation_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "donation_methods_select_example" ON public.donation_methods;
DROP POLICY IF EXISTS "donation_methods_select_auth" ON public.donation_methods;
DROP POLICY IF EXISTS "donation_methods_select" ON public.donation_methods;
DROP POLICY IF EXISTS "donation_methods_read_all" ON public.donation_methods;
CREATE POLICY "donation_methods_select" ON public.donation_methods 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.causes c
    WHERE c.id = donation_methods.cause_id
      AND (c.status IN ('activa', 'cerrada', 'finalizada') OR c.author_id = auth.uid())
  )
);

-- 9. profile_donation_methods (Solo la dueña)
ALTER TABLE public.profile_donation_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_donation_methods_read_all" ON public.profile_donation_methods;
DROP POLICY IF EXISTS "profile_donation_methods_select_own" ON public.profile_donation_methods;
CREATE POLICY "profile_donation_methods_select_own" ON public.profile_donation_methods 
FOR SELECT TO authenticated 
USING (owner_id = auth.uid());

-- 10. profile_private (Solo la dueña)
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ver mis datos privados" ON public.profile_private;
CREATE POLICY "ver mis datos privados" ON public.profile_private 
FOR SELECT TO authenticated 
USING (id = auth.uid());

-- 11. saves (Solo la dueña)
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saves_select_own" ON public.saves;
CREATE POLICY "saves_select_own" ON public.saves 
FOR SELECT TO authenticated 
USING (user_id = auth.uid());

-- 12. reports (Solo la dueña)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports 
FOR SELECT TO authenticated 
USING (reporter_id = auth.uid());

-- 13. activity_events (Todos)
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_events_select" ON public.activity_events;
CREATE POLICY "activity_events_select" ON public.activity_events FOR SELECT USING (true);
