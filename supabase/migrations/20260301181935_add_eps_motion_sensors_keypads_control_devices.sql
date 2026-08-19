/*
  # Add EPS/EZS motion sensors, keypads, and control devices

  1. New Tables
    - `eps_motion_sensors` - PIR and combined motion detectors
    - `eps_keypads` - Control keypads and input devices
    - `eps_control_devices` - Other control/output devices (remotes, relays, communicators, etc.)

  2. Security
    - RLS enabled on all 3 tables
    - Organization-scoped select/insert/update/delete policies
    - Superadmin full access policies via superadmins table
    - Auto-set org_id triggers

  3. Seed Data
    - 8 Jablotron motion sensors
    - 5 Jablotron keypads
    - 10 Jablotron control devices
*/

CREATE TABLE IF NOT EXISTS eps_motion_sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT 'Jablotron',
  model_number text NOT NULL DEFAULT '',
  sensor_type text NOT NULL DEFAULT 'pir' CHECK (sensor_type IN ('pir','pir_camera','dual_tech','curtain','outdoor','pet_immune')),
  connection_type text NOT NULL DEFAULT 'bus' CHECK (connection_type IN ('bus','wireless')),
  detection_range_m numeric NOT NULL DEFAULT 12,
  detection_angle_deg integer NOT NULL DEFAULT 110,
  pet_immune_kg integer NOT NULL DEFAULT 0,
  has_camera boolean NOT NULL DEFAULT false,
  ip_rating text NOT NULL DEFAULT 'IP40',
  price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_motion_sensors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_motion_sensors_select" ON eps_motion_sensors FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_motion_sensors_insert" ON eps_motion_sensors FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_motion_sensors_update" ON eps_motion_sensors FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_motion_sensors_delete" ON eps_motion_sensors FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "superadmin_eps_motion_sensors" ON eps_motion_sensors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS eps_keypads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT 'Jablotron',
  model_number text NOT NULL DEFAULT '',
  keypad_type text NOT NULL DEFAULT 'lcd' CHECK (keypad_type IN ('lcd','segment','rfid','touch','combined')),
  connection_type text NOT NULL DEFAULT 'bus' CHECK (connection_type IN ('bus','wireless')),
  has_rfid boolean NOT NULL DEFAULT false,
  has_display boolean NOT NULL DEFAULT true,
  sections_control integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_keypads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_keypads_select" ON eps_keypads FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_keypads_insert" ON eps_keypads FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_keypads_update" ON eps_keypads FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_keypads_delete" ON eps_keypads FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "superadmin_eps_keypads" ON eps_keypads FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS eps_control_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT 'Jablotron',
  model_number text NOT NULL DEFAULT '',
  device_type text NOT NULL DEFAULT 'other' CHECK (device_type IN ('remote_control','relay_output','communicator','expander','thermostat','rfid_tag','other')),
  connection_type text NOT NULL DEFAULT 'wireless' CHECK (connection_type IN ('bus','wireless','standalone')),
  price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eps_control_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_control_devices_select" ON eps_control_devices FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_control_devices_insert" ON eps_control_devices FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_control_devices_update" ON eps_control_devices FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "eps_control_devices_delete" ON eps_control_devices FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY "superadmin_eps_control_devices" ON eps_control_devices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()));

-- Auto-set org_id triggers
CREATE OR REPLACE FUNCTION set_eps_motion_sensors_org_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_eps_motion_sensors_org_id_trigger
  BEFORE INSERT ON eps_motion_sensors
  FOR EACH ROW EXECUTE FUNCTION set_eps_motion_sensors_org_id();

CREATE OR REPLACE FUNCTION set_eps_keypads_org_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_eps_keypads_org_id_trigger
  BEFORE INSERT ON eps_keypads
  FOR EACH ROW EXECUTE FUNCTION set_eps_keypads_org_id();

CREATE OR REPLACE FUNCTION set_eps_control_devices_org_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_eps_control_devices_org_id_trigger
  BEFORE INSERT ON eps_control_devices
  FOR EACH ROW EXECUTE FUNCTION set_eps_control_devices_org_id();

-- Seed data
INSERT INTO eps_motion_sensors (org_id, name, manufacturer, model_number, sensor_type, connection_type, detection_range_m, detection_angle_deg, pet_immune_kg, has_camera, ip_rating, price, purchase_price)
SELECT o.id, v.name, v.manufacturer, v.model_number, v.sensor_type, v.connection_type, v.detection_range_m, v.detection_angle_deg, v.pet_immune_kg, v.has_camera, v.ip_rating, v.price, v.purchase_price
FROM organizations o
CROSS JOIN (VALUES
  ('JA-150P PIR detektor','Jablotron','JA-150P','pir','wireless',12,110,0,false,'IP40',1290,890),
  ('JA-151P PIR mini','Jablotron','JA-151P','pir','wireless',8,90,0,false,'IP40',990,690),
  ('JA-160PC PIR s kamerou','Jablotron','JA-160PC','pir_camera','wireless',12,90,0,true,'IP40',2490,1790),
  ('JA-150P-DG PIR pet imunni','Jablotron','JA-150P-DG','pet_immune','wireless',12,110,20,false,'IP40',1490,1050),
  ('JA-110P PIR bus','Jablotron','JA-110P','pir','bus',12,110,0,false,'IP40',990,690),
  ('JA-110M PIR+MW dual','Jablotron','JA-110M','dual_tech','bus',12,110,0,false,'IP40',1690,1190),
  ('JA-152E opticka zavora','Jablotron','JA-152E','curtain','wireless',6,10,0,false,'IP40',1390,990),
  ('JA-158P venkovni PIR','Jablotron','JA-158P','outdoor','wireless',12,90,0,false,'IP54',2190,1590)
) AS v(name,manufacturer,model_number,sensor_type,connection_type,detection_range_m,detection_angle_deg,pet_immune_kg,has_camera,ip_rating,price,purchase_price);

INSERT INTO eps_keypads (org_id, name, manufacturer, model_number, keypad_type, connection_type, has_rfid, has_display, sections_control, price, purchase_price)
SELECT o.id, v.name, v.manufacturer, v.model_number, v.keypad_type, v.connection_type, v.has_rfid, v.has_display, v.sections_control, v.price, v.purchase_price
FROM organizations o
CROSS JOIN (VALUES
  ('JA-114E LCD klavesnice','Jablotron','JA-114E','lcd','bus',true,true,4,2490,1790),
  ('JA-154E bezdratova LCD','Jablotron','JA-154E','lcd','wireless',true,true,4,3290,2390),
  ('JA-113E segmentova','Jablotron','JA-113E','segment','bus',false,true,1,990,690),
  ('JA-112E pristupovy modul','Jablotron','JA-112E','rfid','bus',true,false,1,1490,1050),
  ('JA-150A dotykova','Jablotron','JA-150A','touch','wireless',false,true,2,2890,2090)
) AS v(name,manufacturer,model_number,keypad_type,connection_type,has_rfid,has_display,sections_control,price,purchase_price);

INSERT INTO eps_control_devices (org_id, name, manufacturer, model_number, device_type, connection_type, price, purchase_price)
SELECT o.id, v.name, v.manufacturer, v.model_number, v.device_type, v.connection_type, v.price, v.purchase_price
FROM organizations o
CROSS JOIN (VALUES
  ('JA-154J dalkovak 2tl','Jablotron','JA-154J','remote_control','wireless',590,390),
  ('JA-152J dalkovak 4tl','Jablotron','JA-152J','remote_control','wireless',690,490),
  ('JA-110A rele modul PG','Jablotron','JA-110A','relay_output','bus',490,350),
  ('JA-111R bezdr. rele modul','Jablotron','JA-111R','relay_output','wireless',890,620),
  ('JA-190J LAN komunikator','Jablotron','JA-190J','communicator','bus',3490,2490),
  ('JA-110I sbern. rozsirovac','Jablotron','JA-110I','expander','bus',1290,890),
  ('JA-110T termostat bus','Jablotron','JA-110T','thermostat','bus',1890,1350),
  ('JA-191J RFID cipek','Jablotron','JA-191J','rfid_tag','standalone',190,120),
  ('JA-192J RFID karta','Jablotron','JA-192J','rfid_tag','standalone',190,120),
  ('JA-150TP panikovy ovladac','Jablotron','JA-150TP','remote_control','wireless',890,620)
) AS v(name,manufacturer,model_number,device_type,connection_type,price,purchase_price);
