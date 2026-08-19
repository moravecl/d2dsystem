/*
  # Create EPS (Elektronicka Pozarni Signalizace) / Alarm Schema

  1. New Tables
    - `eps_detector_models` - Catalog of EPS detectors (smoke, heat, combined, linear, manual call points, gas, CO, flame)
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - Display name
      - `manufacturer` (text, default 'Jablotron')
      - `model_number` (text) - e.g. JA-110ST
      - `detector_type` (text) - smoke/heat/smoke_heat/linear/manual_call_point/gas/co/flame
      - `connection_type` (text) - bus/wireless
      - `detection_range_m` (numeric) - Detection radius in meters
      - `detection_angle_deg` (numeric) - Coverage angle in degrees
      - `max_coverage_area_m2` (numeric) - Max protected area
      - `max_ceiling_height_m` (numeric) - Max ceiling height for proper function
      - `has_siren` (boolean) - Built-in siren
      - `ip_rating` (text)
      - `operating_temp_min` (numeric)
      - `operating_temp_max` (numeric)
      - `power_source` (text) - bus_12v/battery_aa/battery_lithium/mains_230v
      - `battery_life_years` (numeric, nullable)
      - `frequency_mhz` (numeric, nullable) - For wireless devices
      - `wireless_range_m` (numeric, nullable)
      - `en_class` (text) - e.g. EN 54-5 A2
      - `price` (numeric) - Selling price
      - `purchase_price` (numeric) - Cost price
      - `image_url` (text, nullable)
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)

    - `eps_panels` - EPS control panels (ustredny)
      - `id`, `org_id`, `name`, `manufacturer`, `model_number`
      - `max_zones` - Number of zones/loops
      - `max_sections` - Number of sections
      - `max_users` - Number of user codes
      - `bus_support`, `wireless_support` (booleans)
      - `communicator_type` (text) - gsm/gsm_lan/gsm_gprs/none
      - `backup_battery_ah` (numeric)
      - `price`, `purchase_price`, `image_url`, `notes`, `is_active`

    - `eps_sirens` - Sirens (indoor, outdoor)
      - `id`, `org_id`, `name`, `manufacturer`, `model_number`
      - `siren_type` (text) - indoor/outdoor/combined
      - `connection_type` (text) - bus/wireless
      - `sound_level_db` (numeric)
      - `has_strobe` (boolean) - Optical beacon
      - `power_source`, `ip_rating`
      - `price`, `purchase_price`, `image_url`, `notes`, `is_active`

    - `eps_cables` - Fire-resistant cables
      - `id`, `org_id`, `name`
      - `cable_type` (text) - jhfe/jb_h_st/shf/standard
      - `fire_resistance_minutes` (integer) - 30/60/90 min
      - `max_length_m`, `price_per_m`, `purchase_price_per_m`
      - `notes`, `is_active`

    - `eps_accessories` - Accessories (bases, modules, repeaters, power supplies)
      - `id`, `org_id`, `name`
      - `accessory_type` (text) - base/module/repeater/power_supply/io_module/other
      - `price`, `purchase_price`, `image_url`, `notes`, `is_active`

    - `eps_designs` - EPS designs per project (JSONB design_data)
      - `id`, `org_id`, `project_id`, `name`, `design_data` (jsonb)

    - `eps_design_versions` - Design version snapshots
      - `id`, `eps_design_id`, `org_id`, `version_number`, `note`
      - `summary_detector_count`, `summary_total_price`, `design_data` (jsonb)

  2. Security
    - RLS enabled on ALL tables
    - Policies scoped to organization membership via org_id
    - Auto-set org_id triggers

  3. Seed Data
    - Jablotron 100+ detectors (JA-110ST, JA-111ST-A, JA-150ST, JA-151ST-A, etc.)
    - Jablotron panels (JA-101K, JA-106K, JA-107K)
    - Sirens (JA-110A, JA-150A, JA-163A)
    - Fire-resistant cables (JHFE, JB-H-ST)
    - Common accessories (patice, moduly)
*/

-- =============================================================================
-- eps_detector_models
-- =============================================================================
CREATE TABLE IF NOT EXISTS eps_detector_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT 'Jablotron',
  model_number text NOT NULL DEFAULT '',
  detector_type text NOT NULL DEFAULT 'smoke',
  connection_type text NOT NULL DEFAULT 'bus',
  detection_range_m numeric NOT NULL DEFAULT 7.5,
  detection_angle_deg numeric NOT NULL DEFAULT 360,
  max_coverage_area_m2 numeric NOT NULL DEFAULT 150,
  max_ceiling_height_m numeric NOT NULL DEFAULT 12,
  has_siren boolean NOT NULL DEFAULT false,
  ip_rating text NOT NULL DEFAULT 'IP40',
  operating_temp_min numeric NOT NULL DEFAULT -10,
  operating_temp_max numeric NOT NULL DEFAULT 55,
  power_source text NOT NULL DEFAULT 'bus_12v',
  battery_life_years numeric,
  frequency_mhz numeric,
  wireless_range_m numeric,
  en_class text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_detector_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_detectors_select" ON eps_detector_models FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_detectors_insert" ON eps_detector_models FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_detectors_update" ON eps_detector_models FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_detectors_delete" ON eps_detector_models FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

-- =============================================================================
-- eps_panels
-- =============================================================================
CREATE TABLE IF NOT EXISTS eps_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT 'Jablotron',
  model_number text NOT NULL DEFAULT '',
  max_zones integer NOT NULL DEFAULT 50,
  max_sections integer NOT NULL DEFAULT 15,
  max_users integer NOT NULL DEFAULT 50,
  bus_support boolean NOT NULL DEFAULT true,
  wireless_support boolean NOT NULL DEFAULT true,
  communicator_type text NOT NULL DEFAULT 'gsm_lan',
  backup_battery_ah numeric NOT NULL DEFAULT 7,
  price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_panels_select" ON eps_panels FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_panels_insert" ON eps_panels FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_panels_update" ON eps_panels FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_panels_delete" ON eps_panels FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

-- =============================================================================
-- eps_sirens
-- =============================================================================
CREATE TABLE IF NOT EXISTS eps_sirens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT 'Jablotron',
  model_number text NOT NULL DEFAULT '',
  siren_type text NOT NULL DEFAULT 'indoor',
  connection_type text NOT NULL DEFAULT 'bus',
  sound_level_db numeric NOT NULL DEFAULT 100,
  has_strobe boolean NOT NULL DEFAULT true,
  power_source text NOT NULL DEFAULT 'bus_12v',
  ip_rating text NOT NULL DEFAULT 'IP40',
  price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_sirens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_sirens_select" ON eps_sirens FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_sirens_insert" ON eps_sirens FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_sirens_update" ON eps_sirens FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_sirens_delete" ON eps_sirens FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

-- =============================================================================
-- eps_cables
-- =============================================================================
CREATE TABLE IF NOT EXISTS eps_cables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  cable_type text NOT NULL DEFAULT 'standard',
  fire_resistance_minutes integer NOT NULL DEFAULT 0,
  max_length_m numeric NOT NULL DEFAULT 500,
  price_per_m numeric NOT NULL DEFAULT 0,
  purchase_price_per_m numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_cables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_cables_select" ON eps_cables FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_cables_insert" ON eps_cables FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_cables_update" ON eps_cables FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_cables_delete" ON eps_cables FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

-- =============================================================================
-- eps_accessories
-- =============================================================================
CREATE TABLE IF NOT EXISTS eps_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  accessory_type text NOT NULL DEFAULT 'other',
  price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_accessories_select" ON eps_accessories FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_accessories_insert" ON eps_accessories FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_accessories_update" ON eps_accessories FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_accessories_delete" ON eps_accessories FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

-- =============================================================================
-- eps_designs
-- =============================================================================
CREATE TABLE IF NOT EXISTS eps_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid REFERENCES projects(id),
  name text NOT NULL DEFAULT 'EPS navrh',
  design_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_designs_select" ON eps_designs FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_designs_insert" ON eps_designs FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_designs_update" ON eps_designs FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_designs_delete" ON eps_designs FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

-- =============================================================================
-- eps_design_versions
-- =============================================================================
CREATE TABLE IF NOT EXISTS eps_design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eps_design_id uuid NOT NULL REFERENCES eps_designs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id),
  version_number integer NOT NULL DEFAULT 1,
  note text NOT NULL DEFAULT '',
  summary_detector_count integer NOT NULL DEFAULT 0,
  summary_total_price numeric NOT NULL DEFAULT 0,
  design_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE eps_design_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_versions_select" ON eps_design_versions FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_versions_insert" ON eps_design_versions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_versions_update" ON eps_design_versions FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "eps_versions_delete" ON eps_design_versions FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

-- =============================================================================
-- Auto-set org_id triggers (reuse pattern from existing tables)
-- =============================================================================
CREATE OR REPLACE FUNCTION set_eps_org_id() RETURNS trigger AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_eps_detector_models_org_id') THEN
    CREATE TRIGGER set_eps_detector_models_org_id BEFORE INSERT ON eps_detector_models FOR EACH ROW EXECUTE FUNCTION set_eps_org_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_eps_panels_org_id') THEN
    CREATE TRIGGER set_eps_panels_org_id BEFORE INSERT ON eps_panels FOR EACH ROW EXECUTE FUNCTION set_eps_org_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_eps_sirens_org_id') THEN
    CREATE TRIGGER set_eps_sirens_org_id BEFORE INSERT ON eps_sirens FOR EACH ROW EXECUTE FUNCTION set_eps_org_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_eps_cables_org_id') THEN
    CREATE TRIGGER set_eps_cables_org_id BEFORE INSERT ON eps_cables FOR EACH ROW EXECUTE FUNCTION set_eps_org_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_eps_accessories_org_id') THEN
    CREATE TRIGGER set_eps_accessories_org_id BEFORE INSERT ON eps_accessories FOR EACH ROW EXECUTE FUNCTION set_eps_org_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_eps_designs_org_id') THEN
    CREATE TRIGGER set_eps_designs_org_id BEFORE INSERT ON eps_designs FOR EACH ROW EXECUTE FUNCTION set_eps_org_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_eps_design_versions_org_id') THEN
    CREATE TRIGGER set_eps_design_versions_org_id BEFORE INSERT ON eps_design_versions FOR EACH ROW EXECUTE FUNCTION set_eps_org_id();
  END IF;
END $$;

-- Updated_at trigger for eps_designs
CREATE OR REPLACE FUNCTION set_eps_designs_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_eps_designs_updated_at') THEN
    CREATE TRIGGER trigger_eps_designs_updated_at BEFORE UPDATE ON eps_designs FOR EACH ROW EXECUTE FUNCTION set_eps_designs_updated_at();
  END IF;
END $$;

-- Superadmin full access (if superadmin policies exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "superadmin_eps_detector_models" ON eps_detector_models FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));
    CREATE POLICY "superadmin_eps_panels" ON eps_panels FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));
    CREATE POLICY "superadmin_eps_sirens" ON eps_sirens FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));
    CREATE POLICY "superadmin_eps_cables" ON eps_cables FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));
    CREATE POLICY "superadmin_eps_accessories" ON eps_accessories FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));
    CREATE POLICY "superadmin_eps_designs" ON eps_designs FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));
    CREATE POLICY "superadmin_eps_design_versions" ON eps_design_versions FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- SEED DATA - Insert Jablotron products for all existing organizations
-- =============================================================================
INSERT INTO eps_detector_models (org_id, name, manufacturer, model_number, detector_type, connection_type, detection_range_m, detection_angle_deg, max_coverage_area_m2, max_ceiling_height_m, has_siren, ip_rating, operating_temp_min, operating_temp_max, power_source, en_class, price, purchase_price)
SELECT o.id,
  vals.name, vals.manufacturer, vals.model_number, vals.detector_type, vals.connection_type,
  vals.detection_range_m, vals.detection_angle_deg, vals.max_coverage_area_m2, vals.max_ceiling_height_m,
  vals.has_siren, vals.ip_rating, vals.operating_temp_min, vals.operating_temp_max,
  vals.power_source, vals.en_class, vals.price, vals.purchase_price
FROM organizations o
CROSS JOIN (VALUES
  ('JA-110ST Opticko-kouřový detektor', 'Jablotron', 'JA-110ST', 'smoke', 'bus', 7.5, 360, 150, 12, false, 'IP40', -10, 55, 'bus_12v', 'EN 54-7', 890, 620),
  ('JA-111ST-A Kombinovaný detektor kouře a tepla', 'Jablotron', 'JA-111ST-A', 'smoke_heat', 'bus', 7.5, 360, 150, 12, false, 'IP40', -10, 55, 'bus_12v', 'EN 54-5 A2, EN 54-7', 1250, 870),
  ('JA-150ST Bezdrátový kouřový detektor', 'Jablotron', 'JA-150ST', 'smoke', 'wireless', 7.5, 360, 150, 12, true, 'IP40', -10, 55, 'battery_lithium', 'EN 54-7', 1490, 1040),
  ('JA-151ST-A Bezdr. kombinovaný detektor', 'Jablotron', 'JA-151ST-A', 'smoke_heat', 'wireless', 7.5, 360, 150, 12, true, 'IP40', -10, 55, 'battery_lithium', 'EN 54-5 A2, EN 54-7', 1890, 1320),
  ('JA-110H Tepelný detektor', 'Jablotron', 'JA-110H', 'heat', 'bus', 5.5, 360, 95, 9, false, 'IP40', -10, 55, 'bus_12v', 'EN 54-5 A2', 690, 480),
  ('JA-150H Bezdrátový tepelný detektor', 'Jablotron', 'JA-150H', 'heat', 'wireless', 5.5, 360, 95, 9, true, 'IP40', -10, 55, 'battery_lithium', 'EN 54-5 A2', 1290, 900),
  ('JA-110M Tlačítkový hlásič', 'Jablotron', 'JA-110M', 'manual_call_point', 'bus', 0, 0, 0, 0, false, 'IP40', -10, 55, 'bus_12v', 'EN 54-11', 590, 410),
  ('JA-110G Detektor plynu', 'Jablotron', 'JA-110G', 'gas', 'bus', 5, 360, 80, 6, false, 'IP40', 0, 50, 'bus_12v', '', 1590, 1110),
  ('JA-150G Bezdrátový detektor plynu', 'Jablotron', 'JA-150G', 'gas', 'wireless', 5, 360, 80, 6, true, 'IP40', 0, 50, 'battery_lithium', '', 1990, 1390),
  ('JA-110C Detektor CO', 'Jablotron', 'JA-110C', 'co', 'bus', 5, 360, 80, 6, false, 'IP40', -10, 55, 'bus_12v', 'EN 50291-1', 1290, 900),
  ('JA-150C Bezdrátový detektor CO', 'Jablotron', 'JA-150C', 'co', 'wireless', 5, 360, 80, 6, true, 'IP40', -10, 55, 'battery_lithium', 'EN 50291-1', 1690, 1180),
  ('JA-110L Lineární kouřový detektor', 'Jablotron', 'JA-110L', 'linear', 'bus', 100, 10, 1500, 25, false, 'IP54', -10, 55, 'bus_12v', 'EN 54-12', 4990, 3490)
) AS vals(name, manufacturer, model_number, detector_type, connection_type, detection_range_m, detection_angle_deg, max_coverage_area_m2, max_ceiling_height_m, has_siren, ip_rating, operating_temp_min, operating_temp_max, power_source, en_class, price, purchase_price);

INSERT INTO eps_panels (org_id, name, manufacturer, model_number, max_zones, max_sections, max_users, bus_support, wireless_support, communicator_type, backup_battery_ah, price, purchase_price)
SELECT o.id,
  vals.name, vals.manufacturer, vals.model_number, vals.max_zones, vals.max_sections,
  vals.max_users, vals.bus_support, vals.wireless_support, vals.communicator_type,
  vals.backup_battery_ah, vals.price, vals.purchase_price
FROM organizations o
CROSS JOIN (VALUES
  ('JA-101K Ústředna Jablotron 100+', 'Jablotron', 'JA-101K', 50, 15, 50, true, true, 'gsm_lan', 7, 6990, 4890),
  ('JA-106K Velká ústředna', 'Jablotron', 'JA-106K', 120, 32, 300, true, true, 'gsm_lan', 18, 12990, 9090),
  ('JA-107K Průmyslová ústředna', 'Jablotron', 'JA-107K', 240, 64, 600, true, true, 'gsm_gprs', 24, 22990, 16090),
  ('JA-101KR Kompaktní ústředna', 'Jablotron', 'JA-101KR', 32, 8, 32, true, true, 'gsm', 3.6, 4990, 3490)
) AS vals(name, manufacturer, model_number, max_zones, max_sections, max_users, bus_support, wireless_support, communicator_type, backup_battery_ah, price, purchase_price);

INSERT INTO eps_sirens (org_id, name, manufacturer, model_number, siren_type, connection_type, sound_level_db, has_strobe, power_source, ip_rating, price, purchase_price)
SELECT o.id,
  vals.name, vals.manufacturer, vals.model_number, vals.siren_type, vals.connection_type,
  vals.sound_level_db, vals.has_strobe, vals.power_source, vals.ip_rating, vals.price, vals.purchase_price
FROM organizations o
CROSS JOIN (VALUES
  ('JA-110A Vnitřní siréna', 'Jablotron', 'JA-110A', 'indoor', 'bus', 100, true, 'bus_12v', 'IP40', 890, 620),
  ('JA-150A Bezdrátová vnitřní siréna', 'Jablotron', 'JA-150A', 'indoor', 'wireless', 85, true, 'battery_lithium', 'IP40', 1290, 900),
  ('JA-163A Venkovní siréna', 'Jablotron', 'JA-163A', 'outdoor', 'bus', 110, true, 'bus_12v', 'IP65', 2490, 1740),
  ('JA-164A Bezdr. venkovní siréna', 'Jablotron', 'JA-164A', 'outdoor', 'wireless', 110, true, 'battery_lithium', 'IP65', 3290, 2300),
  ('JA-111A-BASE Kombinovaná siréna', 'Jablotron', 'JA-111A', 'combined', 'bus', 95, true, 'bus_12v', 'IP40', 990, 690)
) AS vals(name, manufacturer, model_number, siren_type, connection_type, sound_level_db, has_strobe, power_source, ip_rating, price, purchase_price);

INSERT INTO eps_cables (org_id, name, cable_type, fire_resistance_minutes, max_length_m, price_per_m, purchase_price_per_m)
SELECT o.id,
  vals.name, vals.cable_type, vals.fire_resistance_minutes, vals.max_length_m, vals.price_per_m, vals.purchase_price_per_m
FROM organizations o
CROSS JOIN (VALUES
  ('JHFE 2x1 Požární kabel', 'jhfe', 90, 500, 42, 29),
  ('JHFE 2x1.5 Požární kabel', 'jhfe', 90, 500, 52, 36),
  ('JB-H(ST) 2x1 Bezhalogenový kabel', 'jb_h_st', 30, 500, 28, 19),
  ('SHF 2x0.5 Sdělovací požární kabel', 'shf', 60, 300, 35, 24),
  ('Standardní sběrnicový kabel 2x1', 'standard', 0, 500, 18, 12)
) AS vals(name, cable_type, fire_resistance_minutes, max_length_m, price_per_m, purchase_price_per_m);

INSERT INTO eps_accessories (org_id, name, accessory_type, price, purchase_price)
SELECT o.id,
  vals.name, vals.accessory_type, vals.price, vals.purchase_price
FROM organizations o
CROSS JOIN (VALUES
  ('JA-110Z Patice detektoru', 'base', 120, 84),
  ('JA-110Z-IP Patice IP65', 'base', 190, 133),
  ('JA-110R Bezdrátový repeater', 'repeater', 1890, 1320),
  ('JA-121T RS-485 modul', 'module', 990, 690),
  ('JA-114E 4x vstup/výstup modul', 'io_module', 1490, 1040),
  ('JA-190Y Záložní zdroj 12V/2A', 'power_supply', 1990, 1390),
  ('JA-190Y-B Akumulátor 12V/7Ah', 'power_supply', 590, 410)
) AS vals(name, accessory_type, price, purchase_price);
