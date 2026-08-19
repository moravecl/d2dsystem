/*
  # Mounting Groups (Viceramecky)

  1. New Tables
    - `mounting_groups`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `floor_id` (uuid, references project floors)
      - `room_id` (uuid, nullable - references room within floor state)
      - `x` (numeric) - position on floor plan
      - `y` (numeric) - position on floor plan
      - `rotation` (numeric) - rotation angle
      - `frame_size` (integer) - number of module slots (1-5 typically)
      - `design_series_id` (uuid, nullable - references products where kind = 'design_series')
      - `color_name` (text, nullable) - color variant
      - `modules` (jsonb) - array of module configurations
      - `label` (text, nullable)
      - `notes` (text, nullable)
      - `organization_id` (uuid, references organizations)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `mounting_group_slots`
      - `id` (uuid, primary key)
      - `mounting_group_id` (uuid, references mounting_groups)
      - `slot_index` (integer) - position in the frame (0-based)
      - `element_id` (uuid, nullable - references project_design_elements)
      - `module_name` (text) - name of the module type
      - `product_id` (uuid, nullable - references products)
      - `organization_id` (uuid, references organizations)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for organization-scoped access

  3. Notes
    - Mounting groups represent physical multi-gang frames that can contain
      multiple electrical modules (switches, outlets, etc.)
    - Each slot in the group can reference a design element or specify a module directly
*/

CREATE TABLE IF NOT EXISTS mounting_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  floor_id text,
  room_id text,
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  rotation numeric NOT NULL DEFAULT 0,
  frame_size integer NOT NULL DEFAULT 1 CHECK (frame_size >= 1 AND frame_size <= 10),
  design_series_id uuid REFERENCES products(id) ON DELETE SET NULL,
  color_name text,
  modules jsonb DEFAULT '[]'::jsonb,
  label text,
  notes text,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mounting_group_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mounting_group_id uuid NOT NULL REFERENCES mounting_groups(id) ON DELETE CASCADE,
  slot_index integer NOT NULL DEFAULT 0 CHECK (slot_index >= 0),
  element_id uuid REFERENCES project_design_elements(id) ON DELETE SET NULL,
  module_name text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(mounting_group_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_mg_project ON mounting_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_mg_floor ON mounting_groups(floor_id);
CREATE INDEX IF NOT EXISTS idx_mg_room ON mounting_groups(room_id);
CREATE INDEX IF NOT EXISTS idx_mg_org ON mounting_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_mgs_group ON mounting_group_slots(mounting_group_id);
CREATE INDEX IF NOT EXISTS idx_mgs_element ON mounting_group_slots(element_id);
CREATE INDEX IF NOT EXISTS idx_mgs_org ON mounting_group_slots(organization_id);

ALTER TABLE mounting_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE mounting_group_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view mounting groups"
  ON mounting_groups
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert mounting groups"
  ON mounting_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update mounting groups"
  ON mounting_groups
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete mounting groups"
  ON mounting_groups
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can view mounting group slots"
  ON mounting_group_slots
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert mounting group slots"
  ON mounting_group_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update mounting group slots"
  ON mounting_group_slots
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete mounting group slots"
  ON mounting_group_slots
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_mg_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT om.organization_id INTO NEW.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_mg_org_id ON mounting_groups;
CREATE TRIGGER trigger_set_mg_org_id
  BEFORE INSERT ON mounting_groups
  FOR EACH ROW
  EXECUTE FUNCTION set_mg_org_id();

CREATE OR REPLACE FUNCTION set_mgs_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM mounting_groups
    WHERE id = NEW.mounting_group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_mgs_org_id ON mounting_group_slots;
CREATE TRIGGER trigger_set_mgs_org_id
  BEFORE INSERT ON mounting_group_slots
  FOR EACH ROW
  EXECUTE FUNCTION set_mgs_org_id();
