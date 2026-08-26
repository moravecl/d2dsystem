/*
  # S14: Oprava klientske zony po S7

  Portalove profily nemaji organization_id ani clenstvi v organizaci,
  takze current_org_id() vraci NULL a org-scoped politiky z S7 klienty
  odriznou (katalog, verze navrhu, slozky souboru, jmena autoru).
  Opacnym smerem: zapisy z portalu (pripominky, tikety) vznikaji bez
  organization_id, takze je interni tym nevidi a nechodi notifikace.

  Reseni CILENE (zadne plosne org clenstvi pro klienty - to by jim
  otevrelo firemni data):
  1. helper portal_client_org_id() - organizace klientova zaznamu
  2. SELECT politiky pro portal: katalog (jen jejich organizace),
     verze navrhu, slozky souboru, vybery a piny, jmena clenu tymu
  3. INSERT politika na document_audit_log (schvaleni dokumentu)
  4. triggery doplnujici organization_id z projektu u zapisu z portalu
     + backfill existujicich radku s NULL
*/

-- ============================================================
-- 1. Helper: organizace portaloveho klienta
-- ============================================================
CREATE OR REPLACE FUNCTION portal_client_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.organization_id FROM clients c
     WHERE c.portal_user_id = auth.uid() LIMIT 1),
    (SELECT c.organization_id FROM clients c
     JOIN profiles p ON p.client_id = c.id
     WHERE p.id = auth.uid() AND p.is_portal_client LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION portal_client_org_id() FROM public;
GRANT EXECUTE ON FUNCTION portal_client_org_id() TO authenticated;

-- ============================================================
-- 2. Katalog: klient cte katalog SVE organizace (podklad zalozek
--    Vyber a Pudorys v portalu; pred S7 byl katalog otevreny vsem)
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','categories','subcategories',
    'design_modules','design_presets','materials','heating_systems'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Portal clients can read %s" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "Portal clients can read %s" ON %I FOR SELECT TO authenticated
       USING (is_portal_client_user() AND organization_id = portal_client_org_id())', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Portal clients can read product colors" ON product_colors;
CREATE POLICY "Portal clients can read product colors"
  ON product_colors FOR SELECT TO authenticated
  USING (is_portal_client_user() AND EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_colors.product_id
      AND p.organization_id = portal_client_org_id()
  ));

DROP POLICY IF EXISTS "Portal clients can read heating options" ON heating_system_options;
CREATE POLICY "Portal clients can read heating options"
  ON heating_system_options FOR SELECT TO authenticated
  USING (is_portal_client_user() AND EXISTS (
    SELECT 1 FROM heating_systems h
    WHERE h.id = heating_system_options.heating_system_id
      AND h.organization_id = portal_client_org_id()
  ));

DROP POLICY IF EXISTS "Portal clients can read heating materials" ON heating_system_materials;
CREATE POLICY "Portal clients can read heating materials"
  ON heating_system_materials FOR SELECT TO authenticated
  USING (is_portal_client_user() AND EXISTS (
    SELECT 1 FROM heating_systems h
    WHERE h.id = heating_system_materials.heating_system_id
      AND h.organization_id = portal_client_org_id()
  ));

DROP POLICY IF EXISTS "Portal clients can read category colors" ON element_category_colors;
CREATE POLICY "Portal clients can read category colors"
  ON element_category_colors FOR SELECT TO authenticated
  USING (is_portal_client_user() AND org_id = portal_client_org_id());

-- ============================================================
-- 3. Data projektu: verze navrhu, slozky, vybery, piny
-- ============================================================
DROP POLICY IF EXISTS "Portal clients can read design versions" ON design_versions;
CREATE POLICY "Portal clients can read design versions"
  ON design_versions FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

DROP POLICY IF EXISTS "Portal clients can read project folders" ON project_folders;
CREATE POLICY "Portal clients can read project folders"
  ON project_folders FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

DROP POLICY IF EXISTS "Portal clients can read project selections" ON project_selections;
CREATE POLICY "Portal clients can read project selections"
  ON project_selections FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

DROP POLICY IF EXISTS "Portal clients can read pin placements" ON pin_placements;
CREATE POLICY "Portal clients can read pin placements"
  ON pin_placements FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

-- Schvaleni/odmitnuti dokumentu klientem zapisuje audit zaznam
DROP POLICY IF EXISTS "Portal clients can log document actions" ON document_audit_log;
CREATE POLICY "Portal clients can log document actions"
  ON document_audit_log FOR INSERT TO authenticated
  WITH CHECK (is_portal_client_of_project(project_id));

-- Jmena clenu tymu (autori komentaru, schvalovatele) - jen display data
DROP POLICY IF EXISTS "Portal clients can read team names" ON profiles;
CREATE POLICY "Portal clients can read team names"
  ON profiles FOR SELECT TO authenticated
  USING (is_portal_client_user() AND id IN (
    SELECT om.user_id FROM organization_members om
    WHERE om.organization_id = portal_client_org_id()
  ));

-- ============================================================
-- 4. Zapisy z portalu: doplnit organization_id z projektu
-- ============================================================
CREATE OR REPLACE FUNCTION s14_fill_org_from_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT p.organization_id INTO NEW.organization_id
    FROM projects p WHERE p.id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s14_fill_org_from_remark()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.remark_id IS NOT NULL THEN
    SELECT COALESCE(r.organization_id, p.organization_id) INTO NEW.organization_id
    FROM project_remarks r
    LEFT JOIN projects p ON p.id = r.project_id
    WHERE r.id = NEW.remark_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS s14_fill_org ON project_remarks;
CREATE TRIGGER s14_fill_org BEFORE INSERT ON project_remarks
  FOR EACH ROW EXECUTE FUNCTION s14_fill_org_from_project();

DROP TRIGGER IF EXISTS s14_fill_org ON service_tickets;
CREATE TRIGGER s14_fill_org BEFORE INSERT ON service_tickets
  FOR EACH ROW EXECUTE FUNCTION s14_fill_org_from_project();

DROP TRIGGER IF EXISTS s14_fill_org ON project_remark_comments;
CREATE TRIGGER s14_fill_org BEFORE INSERT ON project_remark_comments
  FOR EACH ROW EXECUTE FUNCTION s14_fill_org_from_remark();

-- Backfill: zpetne doplnit organizaci u radku zapsanych portalem
UPDATE project_remarks r SET organization_id = p.organization_id
FROM projects p WHERE p.id = r.project_id AND r.organization_id IS NULL;

UPDATE project_remark_comments c SET organization_id = p.organization_id
FROM project_remarks r JOIN projects p ON p.id = r.project_id
WHERE r.id = c.remark_id AND c.organization_id IS NULL;

UPDATE service_tickets t SET organization_id = p.organization_id
FROM projects p WHERE p.id = t.project_id AND t.organization_id IS NULL;

-- ============================================================
-- Kontrola:
--   select count(*) from pg_policies where policyname ilike 'Portal clients%';
--     -> 16
--   select count(*) from service_tickets where organization_id is null;  -> 0
-- ============================================================
