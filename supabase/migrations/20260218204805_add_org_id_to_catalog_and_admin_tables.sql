/*
  # Add organization_id to catalog and admin tables

  ## Problem
  Tables like products, categories, inspirations, design_modules, heating_systems,
  materials, document_templates, email_templates, invoice_settings, system_settings
  have no organization_id - so all users see HouseSmart data in their admin zone.

  ## Changes
  - Add organization_id to all catalog/admin tables
  - Backfill existing rows with the HouseSmart organization ID
  - Drop legacy over-permissive policies
  - Add org-scoped policies
*/

-- Get HouseSmart org id for backfill
DO $$
DECLARE
  hs_org_id uuid;
BEGIN
  SELECT id INTO hs_org_id FROM organizations WHERE name = 'HouseSmart' LIMIT 1;

  -- products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'organization_id') THEN
    ALTER TABLE products ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE products SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- categories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'organization_id') THEN
    ALTER TABLE categories ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE categories SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- subcategories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subcategories' AND column_name = 'organization_id') THEN
    ALTER TABLE subcategories ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE subcategories SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- design_modules
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'design_modules' AND column_name = 'organization_id') THEN
    ALTER TABLE design_modules ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE design_modules SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- design_presets
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'design_presets' AND column_name = 'organization_id') THEN
    ALTER TABLE design_presets ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE design_presets SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- inspirations
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspirations' AND column_name = 'organization_id') THEN
    ALTER TABLE inspirations ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE inspirations SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- heating_systems
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'heating_systems' AND column_name = 'organization_id') THEN
    ALTER TABLE heating_systems ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE heating_systems SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- materials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'organization_id') THEN
    ALTER TABLE materials ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE materials SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- lighting_norms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lighting_norms' AND column_name = 'organization_id') THEN
    ALTER TABLE lighting_norms ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE lighting_norms SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- document_templates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_templates' AND column_name = 'organization_id') THEN
    ALTER TABLE document_templates ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE document_templates SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- email_templates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'organization_id') THEN
    ALTER TABLE email_templates ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE email_templates SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- invoice_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'organization_id') THEN
    ALTER TABLE invoice_settings ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE invoice_settings SET organization_id = hs_org_id WHERE organization_id IS NULL;

  -- system_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_settings' AND column_name = 'organization_id') THEN
    ALTER TABLE system_settings ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  UPDATE system_settings SET organization_id = hs_org_id WHERE organization_id IS NULL;

END $$;

-- ============================================================
-- PRODUCTS
-- ============================================================
DROP POLICY IF EXISTS "Public can read active products" ON products;
DROP POLICY IF EXISTS "Anyone authenticated can read active products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;
DROP POLICY IF EXISTS "Org members can view products" ON products;
DROP POLICY IF EXISTS "Org admins can manage products" ON products;

CREATE POLICY "Org members can view products"
  ON products FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update products"
  ON products FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete products"
  ON products FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- CATEGORIES
-- ============================================================
DROP POLICY IF EXISTS "Public can read categories" ON categories;
DROP POLICY IF EXISTS "Anyone authenticated can read categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Org members can view categories" ON categories;

CREATE POLICY "Org members can view categories"
  ON categories FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- SUBCATEGORIES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read subcategories" ON subcategories;
DROP POLICY IF EXISTS "Org members can view subcategories" ON subcategories;

CREATE POLICY "Org members can view subcategories"
  ON subcategories FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert subcategories"
  ON subcategories FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update subcategories"
  ON subcategories FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete subcategories"
  ON subcategories FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- DESIGN MODULES
-- ============================================================
DROP POLICY IF EXISTS "Public can read design modules" ON design_modules;
DROP POLICY IF EXISTS "Anyone authenticated can read design modules" ON design_modules;
DROP POLICY IF EXISTS "Admins can insert design modules" ON design_modules;
DROP POLICY IF EXISTS "Admins can update design modules" ON design_modules;
DROP POLICY IF EXISTS "Admins can delete design modules" ON design_modules;
DROP POLICY IF EXISTS "Org members can view design modules" ON design_modules;

CREATE POLICY "Org members can view design modules"
  ON design_modules FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert design modules"
  ON design_modules FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update design modules"
  ON design_modules FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete design modules"
  ON design_modules FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- DESIGN PRESETS
-- ============================================================
DROP POLICY IF EXISTS "Public can read design presets" ON design_presets;
DROP POLICY IF EXISTS "Anyone authenticated can read design presets" ON design_presets;
DROP POLICY IF EXISTS "Admins can insert design presets" ON design_presets;
DROP POLICY IF EXISTS "Admins can update design presets" ON design_presets;
DROP POLICY IF EXISTS "Admins can delete design presets" ON design_presets;
DROP POLICY IF EXISTS "Org members can view design presets" ON design_presets;

CREATE POLICY "Org members can view design presets"
  ON design_presets FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert design presets"
  ON design_presets FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update design presets"
  ON design_presets FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete design presets"
  ON design_presets FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- INSPIRATIONS
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view published inspirations" ON inspirations;
DROP POLICY IF EXISTS "Admins can view all inspirations" ON inspirations;
DROP POLICY IF EXISTS "Admins can insert inspirations" ON inspirations;
DROP POLICY IF EXISTS "Admins can update inspirations" ON inspirations;
DROP POLICY IF EXISTS "Admins can delete inspirations" ON inspirations;
DROP POLICY IF EXISTS "Org members can view inspirations" ON inspirations;

CREATE POLICY "Org members can view inspirations"
  ON inspirations FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert inspirations"
  ON inspirations FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update inspirations"
  ON inspirations FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete inspirations"
  ON inspirations FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- HEATING SYSTEMS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read active heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Admins can read all heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Admins can insert heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Admins can update heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Admins can delete heating systems" ON heating_systems;
DROP POLICY IF EXISTS "Org members can view heating systems" ON heating_systems;

CREATE POLICY "Org members can view heating systems"
  ON heating_systems FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert heating systems"
  ON heating_systems FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update heating systems"
  ON heating_systems FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete heating systems"
  ON heating_systems FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- MATERIALS
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read active materials" ON materials;
DROP POLICY IF EXISTS "Admins can insert materials" ON materials;
DROP POLICY IF EXISTS "Admins can update materials" ON materials;
DROP POLICY IF EXISTS "Admins can delete materials" ON materials;
DROP POLICY IF EXISTS "Org members can view materials" ON materials;

CREATE POLICY "Org members can view materials"
  ON materials FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert materials"
  ON materials FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update materials"
  ON materials FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete materials"
  ON materials FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- LIGHTING NORMS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read lighting norms" ON lighting_norms;
DROP POLICY IF EXISTS "Org members can view lighting norms" ON lighting_norms;

CREATE POLICY "Org members can view lighting norms"
  ON lighting_norms FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert lighting norms"
  ON lighting_norms FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update lighting norms"
  ON lighting_norms FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

-- ============================================================
-- DOCUMENT TEMPLATES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view active templates" ON document_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON document_templates;
DROP POLICY IF EXISTS "Org members can view document templates" ON document_templates;

CREATE POLICY "Org members can view document templates"
  ON document_templates FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert document templates"
  ON document_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update document templates"
  ON document_templates FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete document templates"
  ON document_templates FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view email templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can insert email templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can update email templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can delete email templates" ON email_templates;
DROP POLICY IF EXISTS "Org members can view email templates" ON email_templates;

CREATE POLICY "Org members can view email templates"
  ON email_templates FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert email templates"
  ON email_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update email templates"
  ON email_templates FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete email templates"
  ON email_templates FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- INVOICE SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read invoice settings" ON invoice_settings;
DROP POLICY IF EXISTS "Admins can update invoice settings" ON invoice_settings;
DROP POLICY IF EXISTS "Org members can view invoice settings" ON invoice_settings;

CREATE POLICY "Org members can view invoice settings"
  ON invoice_settings FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert invoice settings"
  ON invoice_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update invoice settings"
  ON invoice_settings FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to read system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;
DROP POLICY IF EXISTS "Org members can view system settings" ON system_settings;

CREATE POLICY "Org members can view system settings"
  ON system_settings FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert system settings"
  ON system_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update system settings"
  ON system_settings FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());
