/*
  # Camera System Designer Schema

  1. New Tables
    - `camera_models` - Catalog of camera devices with FOV, resolution, IR range
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `name` (text) - camera model name
      - `manufacturer` (text) - brand
      - `camera_type` (text) - dome / bullet / ptz / fisheye / box
      - `resolution_w` (integer) - horizontal resolution in pixels
      - `resolution_h` (integer) - vertical resolution in pixels
      - `resolution_label` (text) - human-readable e.g. '4K', '2K', '1080p'
      - `h_fov_deg` (numeric) - horizontal field of view in degrees
      - `v_fov_deg` (numeric) - vertical field of view in degrees
      - `lens_mm` (numeric) - focal length in mm
      - `ir_range_m` (numeric) - night vision range in meters
      - `poe` (boolean) - Power over Ethernet support
      - `power_w` (numeric) - power consumption in watts
      - `ip_rating` (text) - ingress protection e.g. IP66, IP67
      - `price` (numeric) - unit price
      - `image_url` (text) - product image
      - `notes` (text)
      - `is_active` (boolean)

    - `camera_nvrs` - Network video recorders
      - `id` (uuid, primary key)
      - `org_id` (uuid)
      - `name`, `manufacturer` (text)
      - `channels` (integer) - max camera channels
      - `max_resolution_label` (text) - max recording resolution
      - `hdd_bays` (integer) - number of HDD slots
      - `max_hdd_tb` (numeric) - max total HDD capacity
      - `poe_ports` (integer) - built-in PoE ports (0 if none)
      - `poe_budget_w` (numeric) - total PoE power budget
      - `throughput_mbps` (numeric) - recording throughput
      - `price` (numeric)
      - `image_url`, `notes` (text)
      - `is_active` (boolean)

    - `camera_cables` - Cable types for camera installations
      - `id` (uuid, primary key)
      - `org_id` (uuid)
      - `name` (text)
      - `cable_type` (text) - utp_cat5e / utp_cat6 / coax / fiber
      - `max_length_m` (integer) - max recommended run length
      - `price_per_m` (numeric)
      - `notes` (text)
      - `is_active` (boolean)

    - `camera_poe_switches` - PoE switches with port count and budget
      - `id` (uuid, primary key)
      - `org_id` (uuid)
      - `name`, `manufacturer` (text)
      - `poe_ports` (integer) - number of PoE ports
      - `uplink_ports` (integer)
      - `poe_budget_w` (numeric) - total PoE power budget in watts
      - `managed` (boolean) - managed vs unmanaged
      - `price` (numeric)
      - `image_url`, `notes` (text)
      - `is_active` (boolean)

    - `camera_accessories` - Brackets, junction boxes, HDD drives, etc.
      - `id` (uuid, primary key)
      - `org_id` (uuid)
      - `name` (text)
      - `accessory_type` (text) - bracket / junction_box / hdd / power_supply / other
      - `capacity_tb` (numeric, nullable) - HDD capacity in TB (only for hdd type)
      - `price` (numeric)
      - `image_url`, `notes` (text)
      - `is_active` (boolean)

    - `camera_designs` - Saved camera system designs per project
      - `id` (uuid, primary key)
      - `org_id` (uuid)
      - `project_id` (uuid, references projects)
      - `name` (text)
      - `design_data` (jsonb) - full design state (layers, cameras, routes, NVR, scale, etc.)
      - `created_at`, `updated_at` (timestamptz)

    - `camera_design_versions` - Design version snapshots
      - `id` (uuid, primary key)
      - `camera_design_id` (uuid, references camera_designs)
      - `org_id` (uuid)
      - `version_number` (integer)
      - `note` (text)
      - `summary_camera_count` (integer)
      - `summary_total_price` (numeric)
      - `design_data` (jsonb) - snapshot of design state
      - `created_at` (timestamptz)
      - `created_by` (uuid)

  2. Security
    - RLS enabled on all tables
    - Policies scoped to organization membership via org_id
    - Org-id auto-set trigger on insert

  3. Notes
    - camera_models h_fov_deg/v_fov_deg used for FOV cone rendering on canvas
    - design_data JSONB stores: layers (array of {name, type:'map'|'image', imageData, mapCenter, mapZoom}),
      cameras (placed camera instances with position, rotation, modelId),
      routes (cable polylines), nvrPlacements, scale calibration, storage config
*/

-- Camera models catalog
CREATE TABLE IF NOT EXISTS camera_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  manufacturer text NOT NULL DEFAULT '',
  camera_type text NOT NULL DEFAULT 'bullet',
  resolution_w integer NOT NULL DEFAULT 1920,
  resolution_h integer NOT NULL DEFAULT 1080,
  resolution_label text NOT NULL DEFAULT '1080p',
  h_fov_deg numeric NOT NULL DEFAULT 90,
  v_fov_deg numeric NOT NULL DEFAULT 50,
  lens_mm numeric NOT NULL DEFAULT 2.8,
  ir_range_m numeric NOT NULL DEFAULT 30,
  poe boolean NOT NULL DEFAULT true,
  power_w numeric NOT NULL DEFAULT 12,
  ip_rating text NOT NULL DEFAULT 'IP67',
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE camera_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camera_models_select_own_org"
  ON camera_models FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_models_insert_own_org"
  ON camera_models FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_models_update_own_org"
  ON camera_models FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_models_delete_own_org"
  ON camera_models FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- NVR catalog
CREATE TABLE IF NOT EXISTS camera_nvrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  manufacturer text NOT NULL DEFAULT '',
  channels integer NOT NULL DEFAULT 8,
  max_resolution_label text NOT NULL DEFAULT '4K',
  hdd_bays integer NOT NULL DEFAULT 1,
  max_hdd_tb numeric NOT NULL DEFAULT 10,
  poe_ports integer NOT NULL DEFAULT 0,
  poe_budget_w numeric NOT NULL DEFAULT 0,
  throughput_mbps numeric NOT NULL DEFAULT 80,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE camera_nvrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camera_nvrs_select_own_org"
  ON camera_nvrs FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_nvrs_insert_own_org"
  ON camera_nvrs FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_nvrs_update_own_org"
  ON camera_nvrs FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_nvrs_delete_own_org"
  ON camera_nvrs FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- Cable types
CREATE TABLE IF NOT EXISTS camera_cables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  cable_type text NOT NULL DEFAULT 'utp_cat5e',
  max_length_m integer NOT NULL DEFAULT 100,
  price_per_m numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE camera_cables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camera_cables_select_own_org"
  ON camera_cables FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_cables_insert_own_org"
  ON camera_cables FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_cables_update_own_org"
  ON camera_cables FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_cables_delete_own_org"
  ON camera_cables FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- PoE switches
CREATE TABLE IF NOT EXISTS camera_poe_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  manufacturer text NOT NULL DEFAULT '',
  poe_ports integer NOT NULL DEFAULT 4,
  uplink_ports integer NOT NULL DEFAULT 1,
  poe_budget_w numeric NOT NULL DEFAULT 60,
  managed boolean NOT NULL DEFAULT false,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE camera_poe_switches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camera_poe_switches_select_own_org"
  ON camera_poe_switches FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_poe_switches_insert_own_org"
  ON camera_poe_switches FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_poe_switches_update_own_org"
  ON camera_poe_switches FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_poe_switches_delete_own_org"
  ON camera_poe_switches FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- Accessories (brackets, junction boxes, HDDs, power supplies)
CREATE TABLE IF NOT EXISTS camera_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  accessory_type text NOT NULL DEFAULT 'other',
  capacity_tb numeric,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE camera_accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camera_accessories_select_own_org"
  ON camera_accessories FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_accessories_insert_own_org"
  ON camera_accessories FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_accessories_update_own_org"
  ON camera_accessories FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_accessories_delete_own_org"
  ON camera_accessories FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- Camera designs (per project)
CREATE TABLE IF NOT EXISTS camera_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid REFERENCES projects(id),
  name text NOT NULL DEFAULT 'Kamerovy system',
  design_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE camera_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camera_designs_select_own_org"
  ON camera_designs FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_designs_insert_own_org"
  ON camera_designs FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_designs_update_own_org"
  ON camera_designs FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_designs_delete_own_org"
  ON camera_designs FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- Camera design versions
CREATE TABLE IF NOT EXISTS camera_design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_design_id uuid NOT NULL REFERENCES camera_designs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id),
  version_number integer NOT NULL DEFAULT 1,
  note text NOT NULL DEFAULT '',
  summary_camera_count integer NOT NULL DEFAULT 0,
  summary_total_price numeric NOT NULL DEFAULT 0,
  design_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE camera_design_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camera_design_versions_select_own_org"
  ON camera_design_versions FOR SELECT TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_design_versions_insert_own_org"
  ON camera_design_versions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_design_versions_update_own_org"
  ON camera_design_versions FOR UPDATE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "camera_design_versions_delete_own_org"
  ON camera_design_versions FOR DELETE TO authenticated
  USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));


-- Auto-set org_id triggers (reuse existing pattern)
CREATE OR REPLACE FUNCTION set_camera_org_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'camera_models', 'camera_nvrs', 'camera_cables',
    'camera_poe_switches', 'camera_accessories',
    'camera_designs', 'camera_design_versions'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_org_id_on_%I
       BEFORE INSERT ON %I
       FOR EACH ROW EXECUTE FUNCTION set_camera_org_id()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Updated_at trigger for camera_designs
CREATE OR REPLACE FUNCTION update_camera_design_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_camera_designs_timestamp
  BEFORE UPDATE ON camera_designs
  FOR EACH ROW EXECUTE FUNCTION update_camera_design_timestamp();
