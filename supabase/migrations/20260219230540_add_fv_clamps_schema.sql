/*
  # FV Panel Clamps Schema

  1. New Tables
    - `fv_clamps` - catalog of panel clamps (mid and end types)
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - e.g. "Stredova prichytka 30-35mm"
      - `clamp_type` (text) - 'mid' (between two panels) or 'end' (at panel edges)
      - `min_thickness_mm` (integer) - min panel frame thickness this clamp fits
      - `max_thickness_mm` (integer) - max panel frame thickness
      - `price` (numeric) - price per piece
      - `image_url` (text, nullable)
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)

  2. Security
    - Enable RLS
    - Admin/manager CRUD, authenticated org member read
    - Superadmin full access

  3. Notes
    - Mid clamps go between adjacent panels in a row
    - End clamps go at the outer edges of each row
    - Per row: end_clamps = 2 * rail_count, mid_clamps = (panels_in_row - 1) * rail_count
*/

CREATE TABLE IF NOT EXISTS fv_clamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  clamp_type text NOT NULL DEFAULT 'mid' CHECK (clamp_type IN ('mid', 'end')),
  min_thickness_mm integer NOT NULL DEFAULT 30,
  max_thickness_mm integer NOT NULL DEFAULT 40,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_clamps ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fv_clamps_org ON fv_clamps(org_id);

CREATE POLICY "Org members can read clamps"
  ON fv_clamps FOR SELECT TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "Admins can insert clamps"
  ON fv_clamps FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can update clamps"
  ON fv_clamps FOR UPDATE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')))
  WITH CHECK (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

CREATE POLICY "Admins can delete clamps"
  ON fv_clamps FOR DELETE TO authenticated
  USING (org_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'superadmins') THEN
    EXECUTE 'CREATE POLICY "Superadmins full access fv_clamps" ON fv_clamps FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM superadmins sa WHERE sa.user_id = auth.uid()))';
  END IF;
END $$;

CREATE TRIGGER set_fv_clamps_org_id BEFORE INSERT ON fv_clamps FOR EACH ROW EXECUTE FUNCTION set_fv_mounting_org_id();
CREATE TRIGGER fv_clamps_updated_at BEFORE UPDATE ON fv_clamps FOR EACH ROW EXECUTE FUNCTION update_fv_updated_at();
