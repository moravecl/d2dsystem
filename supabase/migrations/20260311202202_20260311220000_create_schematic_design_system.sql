/*
  # Schematic Design System — 3-Layer Architecture

  ## Summary
  This migration introduces a new abstraction layer between design elements and catalog products.
  Instead of placing catalog products directly in a floorplan, users now place schematic element
  types. Products are assigned separately — at project level, room level, or per individual element.

  ## New Tables

  ### 1. design_element_types
  A global catalog of schematic element types (outlet, switch, light, camera, detector, etc.).
  These are organization-scoped and can be seeded globally or per-org.
  - `id` — UUID PK
  - `org_id` — optional org scope (null = global/shared)
  - `slug` — unique identifier per org (e.g. "outlet_double", "camera_outdoor")
  - `name` — display name (e.g. "Zásuvka dvojitá")
  - `category` — group: elektro | camera | eps | data | hvac | other
  - `subcategory` — finer grouping (e.g. "sockets", "switches", "lighting")
  - `icon` — SVG or icon key for schematic rendering
  - `default_params` — JSONB: default technical parameters for the type
  - `sort_order` — display ordering

  ### 2. project_design_elements
  Instances of element types placed in a project's floorplan.
  Replaces direct product-keyed placements for the new workflow.
  - `id` — UUID PK
  - `project_id` — FK → projects
  - `org_id` — org isolation
  - `element_type_id` — FK → design_element_types
  - `floor_id` — which floor/level (string, maps to floorplan floor)
  - `room_id` — room assignment (string, maps to room within floor)
  - `x`, `y` — normalized 0–1 position on floorplan
  - `rotation` — degrees 0–359
  - `label` — custom user label (optional)
  - `note` — notes
  - `circuit_id` — electrical circuit reference (optional)
  - `mounting_height` — e.g. "30cm", "WC-height"
  - `quantity` — how many units this placement represents (default 1)
  - `params` — JSONB: per-instance overrides of technical params
  - `sort_order` — ordering within room

  ### 3. element_specifications
  Parametric requirements that influence product matching/filtering.
  Can be set at project level, room level, or element level.
  - `id` — UUID PK
  - `project_id` — FK → projects
  - `org_id` — org isolation
  - `scope` — "project" | "room" | "element"
  - `scope_ref_id` — room_id (string) or element_id (UUID) or null for project
  - `design_series` — e.g. "Mosaic", "Meridian", "Impuls"
  - `color_name` — e.g. "bílá", "antracit", "černá"
  - `color_hex` — hex value
  - `surface` — e.g. "lesklý", "matný"
  - `manufacturer` — preferred manufacturer
  - `ip_rating` — e.g. "IP44", "IP65"
  - `mounting_type` — "pod omítku", "na omítku", "DIN"
  - `extra_params` — JSONB for domain-specific params (resolution, IR range, FOV, etc.)

  ### 4. product_assignments
  Maps a catalog product to an element (or group of elements by scope).
  - `id` — UUID PK
  - `project_id` — FK → projects
  - `org_id` — org isolation
  - `scope` — "project" | "room" | "element"
  - `scope_ref_id` — room_id (string) or element_id (UUID) or null for project-level
  - `element_type_id` — which element type this applies to (null = all types in scope)
  - `product_id` — FK → products (nullable — can be set later)
  - `assignment_type` — "manual" | "auto" | "inherited"
  - `quantity_override` — optional: override default quantity per element
  - `notes` — optional notes

  ### 5. assignment_rules
  Stores project-level and room-level defaults for product selection.
  Used to derive inherited assignments without storing per-element copies.
  - `id` — UUID PK
  - `project_id` — FK → projects
  - `org_id` — org isolation
  - `scope` — "project" | "room"
  - `scope_ref_id` — room_id (string) or null for project scope
  - `element_type_id` — which element type (null = applies to all)
  - `product_id` — FK → products
  - `priority` — integer, higher = takes precedence when multiple rules match

  ### 6. offer_variants
  Named variants of product assignments over a single design.
  Allows generating multiple quote variants (e.g. "Bílá řada", "Antracit") from one layout.
  - `id` — UUID PK
  - `project_id` — FK → projects
  - `org_id` — org isolation
  - `name` — e.g. "Varianta A — bílá", "Varianta B — antracit"
  - `description` — longer description
  - `is_active` — whether this variant is the current default
  - `created_at`, `updated_at`

  (product_assignments will later gain offer_variant_id FK — added as nullable in MVP)

  ## Security
  - RLS enabled on all 6 tables
  - Authenticated org members can read/write within their org
  - Superadmins have full access
*/

-- ─── 1. design_element_types ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS design_element_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  subcategory text,
  icon text,
  default_params jsonb DEFAULT '{}'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, slug)
);

ALTER TABLE design_element_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read design_element_types"
  ON design_element_types FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Admins can insert design_element_types"
  ON design_element_types FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NULL
    OR org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Admins can update design_element_types"
  ON design_element_types FOR UPDATE
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Admins can delete design_element_types"
  ON design_element_types FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ─── 2. project_design_elements ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_design_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  element_type_id uuid NOT NULL REFERENCES design_element_types(id) ON DELETE RESTRICT,
  floor_id text,
  room_id text,
  x numeric DEFAULT 0.5,
  y numeric DEFAULT 0.5,
  rotation integer DEFAULT 0,
  label text,
  note text,
  circuit_id text,
  mounting_height text,
  quantity integer DEFAULT 1,
  params jsonb DEFAULT '{}'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_design_elements_project_id_idx ON project_design_elements(project_id);
CREATE INDEX IF NOT EXISTS project_design_elements_org_id_idx ON project_design_elements(org_id);
CREATE INDEX IF NOT EXISTS project_design_elements_element_type_id_idx ON project_design_elements(element_type_id);

ALTER TABLE project_design_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read project_design_elements"
  ON project_design_elements FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can insert project_design_elements"
  ON project_design_elements FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can update project_design_elements"
  ON project_design_elements FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can delete project_design_elements"
  ON project_design_elements FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ─── 3. element_specifications ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS element_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'room', 'element')),
  scope_ref_id text,
  element_type_id uuid REFERENCES design_element_types(id) ON DELETE CASCADE,
  design_series text,
  color_name text,
  color_hex text,
  surface text,
  manufacturer text,
  ip_rating text,
  mounting_type text,
  extra_params jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS element_specifications_project_id_idx ON element_specifications(project_id);
CREATE INDEX IF NOT EXISTS element_specifications_org_id_idx ON element_specifications(org_id);

ALTER TABLE element_specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read element_specifications"
  ON element_specifications FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can insert element_specifications"
  ON element_specifications FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can update element_specifications"
  ON element_specifications FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can delete element_specifications"
  ON element_specifications FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ─── 4. product_assignments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'room', 'element')),
  scope_ref_id text,
  element_type_id uuid REFERENCES design_element_types(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  assignment_type text NOT NULL DEFAULT 'manual' CHECK (assignment_type IN ('manual', 'auto', 'inherited')),
  quantity_override integer,
  notes text,
  offer_variant_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_assignments_project_id_idx ON product_assignments(project_id);
CREATE INDEX IF NOT EXISTS product_assignments_org_id_idx ON product_assignments(org_id);
CREATE INDEX IF NOT EXISTS product_assignments_element_type_id_idx ON product_assignments(element_type_id);

ALTER TABLE product_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read product_assignments"
  ON product_assignments FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can insert product_assignments"
  ON product_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can update product_assignments"
  ON product_assignments FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can delete product_assignments"
  ON product_assignments FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ─── 5. assignment_rules ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'room')),
  scope_ref_id text,
  element_type_id uuid REFERENCES design_element_types(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignment_rules_project_id_idx ON assignment_rules(project_id);
CREATE INDEX IF NOT EXISTS assignment_rules_org_id_idx ON assignment_rules(org_id);

ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read assignment_rules"
  ON assignment_rules FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can insert assignment_rules"
  ON assignment_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can update assignment_rules"
  ON assignment_rules FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can delete assignment_rules"
  ON assignment_rules FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ─── 6. offer_variants ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offer_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_variants_project_id_idx ON offer_variants(project_id);
CREATE INDEX IF NOT EXISTS offer_variants_org_id_idx ON offer_variants(org_id);

ALTER TABLE offer_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read offer_variants"
  ON offer_variants FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can insert offer_variants"
  ON offer_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can update offer_variants"
  ON offer_variants FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Org members can delete offer_variants"
  ON offer_variants FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ─── FK: product_assignments → offer_variants ─────────────────────────────────

ALTER TABLE product_assignments
  ADD CONSTRAINT product_assignments_offer_variant_id_fkey
  FOREIGN KEY (offer_variant_id) REFERENCES offer_variants(id) ON DELETE SET NULL;

-- ─── org_id auto-fill trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fill_org_id_from_project()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fill_project_design_elements_org_id'
  ) THEN
    CREATE TRIGGER fill_project_design_elements_org_id
      BEFORE INSERT ON project_design_elements
      FOR EACH ROW EXECUTE FUNCTION fill_org_id_from_project();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fill_element_specifications_org_id'
  ) THEN
    CREATE TRIGGER fill_element_specifications_org_id
      BEFORE INSERT ON element_specifications
      FOR EACH ROW EXECUTE FUNCTION fill_org_id_from_project();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fill_product_assignments_org_id'
  ) THEN
    CREATE TRIGGER fill_product_assignments_org_id
      BEFORE INSERT ON product_assignments
      FOR EACH ROW EXECUTE FUNCTION fill_org_id_from_project();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fill_assignment_rules_org_id'
  ) THEN
    CREATE TRIGGER fill_assignment_rules_org_id
      BEFORE INSERT ON assignment_rules
      FOR EACH ROW EXECUTE FUNCTION fill_org_id_from_project();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fill_offer_variants_org_id'
  ) THEN
    CREATE TRIGGER fill_offer_variants_org_id
      BEFORE INSERT ON offer_variants
      FOR EACH ROW EXECUTE FUNCTION fill_org_id_from_project();
  END IF;
END $$;
