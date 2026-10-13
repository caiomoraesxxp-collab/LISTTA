-- LISTTA: somente contas autenticadas podem alterar dados.
-- Leitura pública continua habilitada para o modo visualizador.
DROP POLICY IF EXISTS "anon_insert_schools" ON public.schools;
DROP POLICY IF EXISTS "anon_update_schools" ON public.schools;
DROP POLICY IF EXISTS "anon_delete_schools" ON public.schools;
DROP POLICY IF EXISTS "anon_insert_people" ON public.people;
DROP POLICY IF EXISTS "anon_update_people" ON public.people;
DROP POLICY IF EXISTS "anon_delete_people" ON public.people;

DROP POLICY IF EXISTS "admin_insert_schools" ON public.schools;
DROP POLICY IF EXISTS "admin_update_schools" ON public.schools;
DROP POLICY IF EXISTS "admin_delete_schools" ON public.schools;
DROP POLICY IF EXISTS "admin_insert_people" ON public.people;
DROP POLICY IF EXISTS "admin_update_people" ON public.people;
DROP POLICY IF EXISTS "admin_delete_people" ON public.people;

CREATE POLICY "admin_insert_schools" ON public.schools FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_update_schools" ON public.schools FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_schools" ON public.schools FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_insert_people" ON public.people FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_update_people" ON public.people FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_people" ON public.people FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
