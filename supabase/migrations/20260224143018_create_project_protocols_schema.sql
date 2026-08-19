/*
  # Create project protocols schema

  Schema for technical protocols (pressure tests, electrical inspections,
  recuperation regulation, etc.) attached directly to projects.

  1. New Tables
    - `project_protocols`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK -> projects)
      - `protocol_number` (text, unique identifier e.g. "PR-xxx")
      - `protocol_type` (text) - type key: pressure_test, electrical_inspection,
        recuperation_regulation, gas_inspection, fire_inspection,
        hvac_commissioning, waterproofing_test, thermal_imaging, other
      - `title` (text) - custom title / label
      - `protocol_date` (date) - date of the protocol / inspection
      - `valid_until` (date, nullable) - expiry date if applicable
      - `inspector_name` (text) - name of the inspector / technician
      - `inspector_company` (text) - company of the inspector
      - `result` (text) - pass / fail / conditional
      - `description` (text) - description of what was inspected
      - `findings` (text) - findings / notes
      - `recommendations` (text) - recommendations
      - `notes` (text) - additional notes
      - `measured_values` (jsonb) - structured measured values (pressure, temp, etc.)
      - `inspector_signature` (text) - data URL of signature image
      - `client_signature` (text) - data URL of client signature
      - `status` (text) - draft / completed / archived
      - `created_by` (uuid) - user who created the protocol
      - `organization_id` (uuid)
      - `created_at` / `updated_at` timestamps

    - `protocol_checklist_items`
      - `id` (uuid, primary key)
      - `protocol_id` (uuid, FK -> project_protocols)
      - `label` (text) - checklist item label
      - `checked` (boolean) - whether item passed
      - `note` (text) - note for this item
      - `sort_order` (integer)

  2. Security
    - RLS enabled on both tables
    - Policies for authenticated users scoped to their organization
*/

-- project_protocols table
CREATE TABLE IF NOT EXISTS project_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  protocol_number text NOT NULL DEFAULT '',
  protocol_type text NOT NULL DEFAULT 'other',
  title text NOT NULL DEFAULT '',
  protocol_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  inspector_name text NOT NULL DEFAULT '',
  inspector_company text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT 'pass',
  description text NOT NULL DEFAULT '',
  findings text NOT NULL DEFAULT '',
  recommendations text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  measured_values jsonb NOT NULL DEFAULT '{}',
  inspector_signature text NOT NULL DEFAULT '',
  client_signature text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view project protocols"
  ON project_protocols FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert project protocols"
  ON project_protocols FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update project protocols"
  ON project_protocols FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete project protocols"
  ON project_protocols FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- protocol_checklist_items table
CREATE TABLE IF NOT EXISTS protocol_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES project_protocols(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  checked boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE protocol_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view checklist items"
  ON protocol_checklist_items FOR SELECT
  TO authenticated
  USING (
    protocol_id IN (
      SELECT pp.id FROM project_protocols pp
      WHERE pp.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can insert checklist items"
  ON protocol_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    protocol_id IN (
      SELECT pp.id FROM project_protocols pp
      WHERE pp.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can update checklist items"
  ON protocol_checklist_items FOR UPDATE
  TO authenticated
  USING (
    protocol_id IN (
      SELECT pp.id FROM project_protocols pp
      WHERE pp.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    protocol_id IN (
      SELECT pp.id FROM project_protocols pp
      WHERE pp.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can delete checklist items"
  ON protocol_checklist_items FOR DELETE
  TO authenticated
  USING (
    protocol_id IN (
      SELECT pp.id FROM project_protocols pp
      WHERE pp.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- auto-set organization_id trigger for project_protocols
CREATE OR REPLACE FUNCTION set_project_protocol_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_project_protocol_org_id ON project_protocols;
CREATE TRIGGER trg_set_project_protocol_org_id
  BEFORE INSERT ON project_protocols
  FOR EACH ROW
  EXECUTE FUNCTION set_project_protocol_org_id();
