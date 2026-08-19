/*
  # Fix global catalog vs per-org isolation

  ## Rules
  - GLOBAL (shared, all orgs read): products, categories, subcategories, design_modules,
    design_presets, inspirations, heating_systems, materials, lighting_norms, document_templates
  - PER-ORG: employees, profiles, email_templates, invoice_settings, system_settings,
    company_info, smtp_accounts, project_milestones, employee_vacations

  ## Changes
  1. Revert catalog tables to global read (USING true for authenticated)
  2. Fix profiles - remove cross-org employee profile leak
  3. Fix employees - remove duplicate INSERT policy
  4. Fix project_milestones - add org_id and org-scoped policies
  5. Fix employee_vacations - add org_id and org-scoped policies
*/

-- ============================================================
-- 1. REVERT CATALOG TABLES TO GLOBAL READ
-- ============================================================

-- products
DROP POLICY IF EXISTS "Org members can view products" ON products;
DROP POLICY IF EXISTS "Org admins can insert products" ON products;
DROP POLICY IF EXISTS "Org admins can update products" ON products;
DROP POLICY IF EXISTS "Org admins can delete products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;
DROP POLICY IF EXISTS "Authenticated users can read products" ON products;

CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert products"
  ON products FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update products"
  ON products FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete products"
  ON products FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- categories
DROP POLICY IF EXISTS "Org members can view categories" ON categories;
DROP POLICY IF EXISTS "Org admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Org admins can update categories" ON categories;
DROP POLICY IF EXISTS "Org admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can read categories" ON categories;

CREATE POLICY "Authenticated users can read categories"
  ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- subcategories
DROP POLICY IF EXISTS "Org members can view subcategories" ON subcategories;
DROP POLICY IF EXISTS "Org admins can insert subcategories" ON subcategories;
DROP POLICY IF EXISTS "Org admins can update subcategories" ON subcategories;
DROP POLICY IF EXISTS "Org admins can delete subcategories" ON subcategories;
DROP POLICY IF EXISTS "Admins can insert subcategories" ON subcategories;
DROP POLICY IF EXISTS "Admins can update subcategories" ON subcategories;
DROP POLICY IF EXISTS "Admins can delete subcategories" ON subcategories;
DROP POLICY IF EXISTS "Authenticated users can read subcategories" ON subcategories;

CREATE POLICY "Authenticated users can read subcategories"
  ON subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert subcategories"
  ON subcategories FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update subcategories"
  ON subcategories FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete subcategories"
  ON subcategories FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- design_modules
DROP POLICY IF EXISTS "Org members can view design modules" ON design_modules;
DROP POLICY IF EXISTS "Org admins can insert design modules" ON design_modules;
DROP POLICY IF EXISTS "Org admins can update design modules" ON design_modules;
DROP POLICY IF EXISTS "Org admins can delete design modules" ON design_modules;
DROP POLICY IF EXISTS "Admins can insert design modules" ON design_modules;
DROP POLICY IF EXISTS "Admins can update design modules" ON design_modules;
DROP POLICY IF EXISTS "Admins can delete design modules" ON design_modules;
DROP POLICY IF EXISTS "Authenticated users can read design modules" ON design_modules;

CREATE POLICY "Authenticated users can read design modules"
  ON design_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert design modules"
  ON design_modules FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update design modules"
  ON design_modules FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete design modules"
  ON design_modules FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- design_presets
DROP POLICY IF EXISTS "Org members can view design presets" ON design_presets;
DROP POLICY IF EXISTS "Org admins can insert design presets" ON design_presets;
DROP POLICY IF EXISTS "Org admins can update design presets" ON design_presets;
DROP POLICY IF EXISTS "Org admins can delete design presets" ON design_presets;
DROP POLICY IF EXISTS "Admins can insert design presets" ON design_presets;
DROP POLICY IF EXISTS "Admins can update design presets" ON design_presets;
DROP POLICY IF EXISTS "Admins can delete design presets" ON design_presets;
DROP POLICY IF EXISTS "Authenticated users can read design presets" ON design_presets;

CREATE POLICY "Authenticated users can read design presets"
  ON design_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert design presets"
  ON design_presets FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update design presets"
  ON design_presets FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete design presets"
  ON design_presets FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- inspirations
DROP POLICY IF EXISTS "Org members can view inspirations" ON inspirations;
DROP POLICY IF EXISTS "Org admins can insert inspirations" ON inspirations;
DROP POLICY IF EXISTS "Org admins can update inspirations" ON inspirations;
DROP POLICY IF EXISTS "Org admins can delete inspirations" ON inspirations;
DROP POLICY IF EXISTS "Admins can insert inspirations" ON inspirations;
DROP POLICY IF EXISTS "Admins can update inspirations" ON inspirations;
DROP POLICY IF EXISTS "Admins can delete inspirations" ON inspirations;
DROP POLICY IF EXISTS "Authenticated users can read inspirations" ON inspirations;

CREATE POLICY "Authenticated users can read inspirations"
  ON inspirations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert inspirations"
  ON inspirations FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update inspirations"
  ON inspirations FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete inspirations"
  ON inspirations FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- heating_systems
DROP POLICY IF EXISTS "Org members can view heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Org admins can insert heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Org admins can update heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Org admins can delete heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Admins can insert heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Admins can update heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Admins can delete heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Authenticated users can read heating systems" ON heating_systems;

CREATE POLICY "Authenticated users can read heating systems"
  ON heating_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert heating systems"
  ON heating_systems FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update heating systems"
  ON heating_systems FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete heating systems"
  ON heating_systems FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- materials
DROP POLICY IF EXISTS "Org members can view materials" ON materials;
DROP POLICY IF EXISTS "Org admins can insert materials" ON materials;
DROP POLICY IF EXISTS "Org admins can update materials" ON materials;
DROP POLICY IF EXISTS "Org admins can delete materials" ON materials;
DROP POLICY IF EXISTS "Admins can insert materials" ON materials;
DROP POLICY IF EXISTS "Admins can update materials" ON materials;
DROP POLICY IF EXISTS "Admins can delete materials" ON materials;
DROP POLICY IF EXISTS "Admins can manage materials" ON materials;
DROP POLICY IF EXISTS "Authenticated users can read materials" ON materials;

CREATE POLICY "Authenticated users can read materials"
  ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert materials"
  ON materials FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update materials"
  ON materials FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete materials"
  ON materials FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- lighting_norms
DROP POLICY IF EXISTS "Org members can view lighting norms" ON lighting_norms;
DROP POLICY IF EXISTS "Org admins can insert lighting norms" ON lighting_norms;
DROP POLICY IF EXISTS "Org admins can update lighting norms" ON lighting_norms;
DROP POLICY IF EXISTS "Admins can manage lighting norms" ON lighting_norms;
DROP POLICY IF EXISTS "Admins can update lighting norms" ON lighting_norms;
DROP POLICY IF EXISTS "Authenticated users can read lighting norms" ON lighting_norms;

CREATE POLICY "Authenticated users can read lighting norms"
  ON lighting_norms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert lighting norms"
  ON lighting_norms FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update lighting norms"
  ON lighting_norms FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- document_templates (global shared)
DROP POLICY IF EXISTS "Org members can view document templates" ON document_templates;
DROP POLICY IF EXISTS "Org admins can insert document templates" ON document_templates;
DROP POLICY IF EXISTS "Org admins can update document templates" ON document_templates;
DROP POLICY IF EXISTS "Org admins can delete document templates" ON document_templates;
DROP POLICY IF EXISTS "Admins can insert document templates" ON document_templates;
DROP POLICY IF EXISTS "Admins can update document templates" ON document_templates;
DROP POLICY IF EXISTS "Admins can delete document templates" ON document_templates;
DROP POLICY IF EXISTS "Authenticated users can read document templates" ON document_templates;

CREATE POLICY "Authenticated users can read document templates"
  ON document_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert document templates"
  ON document_templates FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update document templates"
  ON document_templates FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete document templates"
  ON document_templates FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- 2. PROFILES - remove cross-org employee profile leak
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read employee profiles" ON profiles;

-- ============================================================
-- 3. EMPLOYEES - remove duplicate INSERT policy
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert employees" ON employees;

-- ============================================================
-- 4. PROJECT_MILESTONES - org-scoped
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_milestones' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE project_milestones ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

UPDATE project_milestones pm
SET organization_id = p.organization_id
FROM projects p
WHERE pm.project_id = p.id
  AND pm.organization_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can read milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can insert milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can update milestones" ON project_milestones;
DROP POLICY IF EXISTS "Authenticated users can delete milestones" ON project_milestones;
DROP POLICY IF EXISTS "Org members can view milestones" ON project_milestones;
DROP POLICY IF EXISTS "Org members can insert milestones" ON project_milestones;
DROP POLICY IF EXISTS "Org members can update milestones" ON project_milestones;
DROP POLICY IF EXISTS "Org members can delete milestones" ON project_milestones;

CREATE POLICY "Org members can view milestones"
  ON project_milestones FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());
CREATE POLICY "Org members can insert milestones"
  ON project_milestones FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can update milestones"
  ON project_milestones FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can delete milestones"
  ON project_milestones FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

DROP TRIGGER IF EXISTS set_org_id ON project_milestones;
CREATE TRIGGER set_org_id
  BEFORE INSERT ON project_milestones
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- ============================================================
-- 5. EMPLOYEE_VACATIONS - org-scoped
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_vacations' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE employee_vacations ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

UPDATE employee_vacations ev
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = ev.profile_id
  AND ev.organization_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can read vacations" ON employee_vacations;
DROP POLICY IF EXISTS "Authenticated users can update vacations" ON employee_vacations;
DROP POLICY IF EXISTS "Users can insert own vacations" ON employee_vacations;
DROP POLICY IF EXISTS "Users can delete own vacations" ON employee_vacations;
DROP POLICY IF EXISTS "Org members can view employee vacations" ON employee_vacations;
DROP POLICY IF EXISTS "Org members can insert employee vacations" ON employee_vacations;
DROP POLICY IF EXISTS "Org members can update employee vacations" ON employee_vacations;
DROP POLICY IF EXISTS "Org members can delete employee vacations" ON employee_vacations;

CREATE POLICY "Org members can view employee vacations"
  ON employee_vacations FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());
CREATE POLICY "Org members can insert employee vacations"
  ON employee_vacations FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can update employee vacations"
  ON employee_vacations FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can delete employee vacations"
  ON employee_vacations FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

DROP TRIGGER IF EXISTS set_org_id ON employee_vacations;
CREATE TRIGGER set_org_id
  BEFORE INSERT ON employee_vacations
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();
