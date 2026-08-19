/*
  # Photovoltaics (FV) Module Schema

  ## Overview
  This migration creates all tables needed for the photovoltaics (FV/solar) design module.
  It includes product catalogs for panels, inverters, batteries, wallboxes, and accessories,
  as well as a table to store FV system designs linked to projects.

  ## New Tables

  ### fv_panels
  - Solar panel catalog entries with technical specs and pricing
  - Columns: id, org_id, name, manufacturer, power_wp, width_mm, height_mm, depth_mm,
    weight_kg, technology (mono/poly/topcon/hjt), efficiency_pct, warranty_years,
    price, image_url, notes, is_active

  ### fv_inverters
  - Inverter catalog entries
  - Columns: id, org_id, name, manufacturer, power_kw, phases (1/3), mppt_count,
    efficiency_pct, technology (string), price, image_url, notes, is_active

  ### fv_batteries
  - Battery storage catalog entries
  - Columns: id, org_id, name, manufacturer, capacity_kwh, power_kw, chemistry (lfp/nmc/lead),
    cycles, dod_pct, warranty_years, price, image_url, notes, is_active

  ### fv_wallboxes
  - EV wallbox charger catalog entries
  - Columns: id, org_id, name, manufacturer, power_kw, phases (1/3), connector_type,
    smart_charging, price, image_url, notes, is_active

  ### fv_accessories
  - Mounting systems, cables, optimizers and other accessories
  - Columns: id, org_id, name, type (mounting/cable/optimizer/other), unit, price_per_unit,
    notes, is_active

  ### fv_designs
  - Saved FV system designs linked to projects
  - Columns: id, org_id, project_id, name, input_params (JSONB), roofs (JSONB array),
    system_config (JSONB), pvgis_results (JSONB), created_at, updated_at

  ## Security
  - RLS enabled on all tables
  - org_id scoping for all tables (members of the organization can read catalog; admins/managers can write)
  - fv_designs linked to project access

  ## Notes
  1. All catalog tables use org_id for multi-tenancy isolation
  2. fv_designs stores the full design as JSONB for flexibility
  3. Triggers auto-populate org_id from current user's organization membership
*/

-- ==========================================
-- FV PANELS
-- ==========================================
CREATE TABLE IF NOT EXISTS fv_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  power_wp integer NOT NULL DEFAULT 0,
  width_mm integer NOT NULL DEFAULT 0,
  height_mm integer NOT NULL DEFAULT 0,
  depth_mm integer NOT NULL DEFAULT 35,
  weight_kg numeric(6,2) NOT NULL DEFAULT 0,
  technology text NOT NULL DEFAULT 'mono' CHECK (technology IN ('mono','poly','topcon','hjt','other')),
  efficiency_pct numeric(5,2) NOT NULL DEFAULT 0,
  warranty_product_years integer NOT NULL DEFAULT 10,
  warranty_performance_years integer NOT NULL DEFAULT 25,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fv_panels"
  ON fv_panels FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert fv_panels"
  ON fv_panels FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can update fv_panels"
  ON fv_panels FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can delete fv_panels"
  ON fv_panels FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- ==========================================
-- FV INVERTERS
-- ==========================================
CREATE TABLE IF NOT EXISTS fv_inverters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  power_kw numeric(8,2) NOT NULL DEFAULT 0,
  phases integer NOT NULL DEFAULT 3 CHECK (phases IN (1,3)),
  mppt_count integer NOT NULL DEFAULT 1,
  efficiency_pct numeric(5,2) NOT NULL DEFAULT 0,
  technology text NOT NULL DEFAULT 'string',
  max_pv_power_kw numeric(8,2),
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_inverters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fv_inverters"
  ON fv_inverters FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert fv_inverters"
  ON fv_inverters FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can update fv_inverters"
  ON fv_inverters FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can delete fv_inverters"
  ON fv_inverters FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- ==========================================
-- FV BATTERIES
-- ==========================================
CREATE TABLE IF NOT EXISTS fv_batteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  capacity_kwh numeric(8,2) NOT NULL DEFAULT 0,
  power_kw numeric(8,2) NOT NULL DEFAULT 0,
  chemistry text NOT NULL DEFAULT 'lfp' CHECK (chemistry IN ('lfp','nmc','lead','other')),
  cycles integer NOT NULL DEFAULT 3000,
  dod_pct integer NOT NULL DEFAULT 90,
  warranty_years integer NOT NULL DEFAULT 10,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_batteries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fv_batteries"
  ON fv_batteries FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert fv_batteries"
  ON fv_batteries FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can update fv_batteries"
  ON fv_batteries FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can delete fv_batteries"
  ON fv_batteries FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- ==========================================
-- FV WALLBOXES
-- ==========================================
CREATE TABLE IF NOT EXISTS fv_wallboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  power_kw numeric(6,2) NOT NULL DEFAULT 11,
  phases integer NOT NULL DEFAULT 3 CHECK (phases IN (1,3)),
  connector_type text NOT NULL DEFAULT 'type2' CHECK (connector_type IN ('type1','type2','ccs','chademo','other')),
  smart_charging boolean NOT NULL DEFAULT false,
  dynamic_load_balancing boolean NOT NULL DEFAULT false,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_wallboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fv_wallboxes"
  ON fv_wallboxes FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert fv_wallboxes"
  ON fv_wallboxes FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can update fv_wallboxes"
  ON fv_wallboxes FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can delete fv_wallboxes"
  ON fv_wallboxes FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- ==========================================
-- FV ACCESSORIES
-- ==========================================
CREATE TABLE IF NOT EXISTS fv_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'other' CHECK (type IN ('mounting_flat','mounting_pitched','optimizer','cable','combiner','monitoring','protection','other')),
  unit text NOT NULL DEFAULT 'ks',
  price_per_unit numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fv_accessories"
  ON fv_accessories FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert fv_accessories"
  ON fv_accessories FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can update fv_accessories"
  ON fv_accessories FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

CREATE POLICY "Org admins can delete fv_accessories"
  ON fv_accessories FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- ==========================================
-- FV DESIGNS
-- ==========================================
CREATE TABLE IF NOT EXISTS fv_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'FV Návrh',
  input_params jsonb NOT NULL DEFAULT '{}',
  roofs jsonb NOT NULL DEFAULT '[]',
  system_config jsonb NOT NULL DEFAULT '{}',
  pvgis_results jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_designs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS fv_designs_project_id_idx ON fv_designs(project_id);
CREATE INDEX IF NOT EXISTS fv_designs_org_id_idx ON fv_designs(org_id);

CREATE POLICY "Org members can view fv_designs"
  ON fv_designs FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert fv_designs"
  ON fv_designs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update fv_designs"
  ON fv_designs FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete fv_designs"
  ON fv_designs FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ==========================================
-- AUTO-POPULATE ORG_ID TRIGGERS
-- ==========================================
CREATE OR REPLACE FUNCTION set_fv_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT organization_id INTO NEW.org_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER fv_panels_set_org_id
  BEFORE INSERT ON fv_panels
  FOR EACH ROW EXECUTE FUNCTION set_fv_org_id();

CREATE TRIGGER fv_inverters_set_org_id
  BEFORE INSERT ON fv_inverters
  FOR EACH ROW EXECUTE FUNCTION set_fv_org_id();

CREATE TRIGGER fv_batteries_set_org_id
  BEFORE INSERT ON fv_batteries
  FOR EACH ROW EXECUTE FUNCTION set_fv_org_id();

CREATE TRIGGER fv_wallboxes_set_org_id
  BEFORE INSERT ON fv_wallboxes
  FOR EACH ROW EXECUTE FUNCTION set_fv_org_id();

CREATE TRIGGER fv_accessories_set_org_id
  BEFORE INSERT ON fv_accessories
  FOR EACH ROW EXECUTE FUNCTION set_fv_org_id();

CREATE TRIGGER fv_designs_set_org_id
  BEFORE INSERT ON fv_designs
  FOR EACH ROW EXECUTE FUNCTION set_fv_org_id();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_fv_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fv_panels_updated_at BEFORE UPDATE ON fv_panels FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
CREATE TRIGGER fv_inverters_updated_at BEFORE UPDATE ON fv_inverters FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
CREATE TRIGGER fv_batteries_updated_at BEFORE UPDATE ON fv_batteries FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
CREATE TRIGGER fv_wallboxes_updated_at BEFORE UPDATE ON fv_wallboxes FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
CREATE TRIGGER fv_accessories_updated_at BEFORE UPDATE ON fv_accessories FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
CREATE TRIGGER fv_designs_updated_at BEFORE UPDATE ON fv_designs FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();

-- Superadmin access
CREATE POLICY "Superadmins can do everything on fv_panels"
  ON fv_panels FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true);

CREATE POLICY "Superadmins can do everything on fv_inverters"
  ON fv_inverters FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true);

CREATE POLICY "Superadmins can do everything on fv_batteries"
  ON fv_batteries FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true);

CREATE POLICY "Superadmins can do everything on fv_wallboxes"
  ON fv_wallboxes FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true);

CREATE POLICY "Superadmins can do everything on fv_accessories"
  ON fv_accessories FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true);

CREATE POLICY "Superadmins can do everything on fv_designs"
  ON fv_designs FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean = true);
