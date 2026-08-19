/*
  # FV Mounting Construction Schema

  1. New Tables
    - `fv_roof_tiles` - catalog of roof tile/covering types
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - e.g. "Taskova krytina", "Plechova krytina"
      - `type` (text) - tiled/metal_sheet/bitumen/flat/trapezoid/other
      - `hook_spacing_mm` (integer) - distance between hooks along the rail
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)

    - `fv_hooks` - catalog of mounting hooks
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - e.g. "Hak taska standard"
      - `compatible_tile_type` (text) - which tile type this hook works with
      - `height_mm` (integer) - hook height for clearance
      - `price` (numeric) - price per piece
      - `image_url` (text, nullable)
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)

    - `fv_rail_profiles` - catalog of rail/profile types
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - e.g. "Profil 40x40 AL"
      - `width_mm` (integer) - rail width
      - `height_mm` (integer) - rail height
      - `length_mm` (integer) - standard rail length
      - `material` (text) - aluminum/steel/other
      - `price_per_m` (numeric) - price per running meter
      - `image_url` (text, nullable)
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)

  2. Security
    - Enable RLS on all new tables
    - Admin/manager CRUD, authenticated org member read policies
    - Superadmin full access

  3. Notes
    - Hook spacing defines how far apart hooks are placed along each rail
    - Rails at max 1/4 from panel edge (top and bottom)
    - 2/4 gap between the two rails (center of panel)
*/

CREATE TABLE IF NOT EXISTS fv_roof_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'tiled' CHECK (type IN ('tiled', 'metal_sheet', 'bitumen', 'flat', 'trapezoid', 'other')),
  hook_spacing_mm integer NOT NULL DEFAULT 350,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_roof_tiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fv_roof_tiles_org ON fv_roof_tiles(org_id);

CREATE TABLE IF NOT EXISTS fv_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  compatible_tile_type text NOT NULL DEFAULT 'tiled' CHECK (compatible_tile_type IN ('tiled', 'metal_sheet', 'bitumen', 'flat', 'trapezoid', 'other')),
  height_mm integer NOT NULL DEFAULT 80,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_hooks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fv_hooks_org ON fv_hooks(org_id);

CREATE TABLE IF NOT EXISTS fv_rail_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  width_mm integer NOT NULL DEFAULT 40,
  height_mm integer NOT NULL DEFAULT 40,
  length_mm integer NOT NULL DEFAULT 4200,
  material text NOT NULL DEFAULT 'aluminum' CHECK (material IN ('aluminum', 'steel', 'other')),
  price_per_m numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_rail_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fv_rail_profiles_org ON fv_rail_profiles(org_id);

-- RLS: fv_roof_tiles
CREATE POLICY "Org members can read roof tiles"
  ON fv_roof_tiles FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "Admins can insert roof tiles"
  ON fv_roof_tiles FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can update roof tiles"
  ON fv_roof_tiles FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can delete roof tiles"
  ON fv_roof_tiles FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

-- RLS: fv_hooks
CREATE POLICY "Org members can read hooks"
  ON fv_hooks FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "Admins can insert hooks"
  ON fv_hooks FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can update hooks"
  ON fv_hooks FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can delete hooks"
  ON fv_hooks FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

-- RLS: fv_rail_profiles
CREATE POLICY "Org members can read rail profiles"
  ON fv_rail_profiles FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "Admins can insert rail profiles"
  ON fv_rail_profiles FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can update rail profiles"
  ON fv_rail_profiles FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can delete rail profiles"
  ON fv_rail_profiles FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

-- Superadmin full access
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'superadmins') THEN
    EXECUTE 'CREATE POLICY "Superadmins full access fv_roof_tiles" ON fv_roof_tiles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Superadmins full access fv_hooks" ON fv_hooks FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Superadmins full access fv_rail_profiles" ON fv_rail_profiles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()))';
  END IF;
END $$;

-- Auto org_id triggers
CREATE OR REPLACE FUNCTION set_fv_mounting_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_fv_roof_tiles_org_id BEFORE INSERT ON fv_roof_tiles FOR EACH ROW EXECUTE FUNCTION set_fv_mounting_org_id();
CREATE TRIGGER set_fv_hooks_org_id BEFORE INSERT ON fv_hooks FOR EACH ROW EXECUTE FUNCTION set_fv_mounting_org_id();
CREATE TRIGGER set_fv_rail_profiles_org_id BEFORE INSERT ON fv_rail_profiles FOR EACH ROW EXECUTE FUNCTION set_fv_mounting_org_id();

-- Auto updated_at triggers (reuse existing fv function)
CREATE TRIGGER fv_roof_tiles_updated_at BEFORE UPDATE ON fv_roof_tiles FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
CREATE TRIGGER fv_hooks_updated_at BEFORE UPDATE ON fv_hooks FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
CREATE TRIGGER fv_rail_profiles_updated_at BEFORE UPDATE ON fv_rail_profiles FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
