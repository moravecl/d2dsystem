/*
  # Create protocol templates schema

  Templates for project protocols (pressure tests, electrical inspections, etc.)
  that can be managed in admin and used when creating new protocols.

  1. New Tables
    - `protocol_templates`
      - `id` (uuid, primary key)
      - `organization_id` (uuid)
      - `protocol_type` (text) - type key matching project_protocols
      - `name` (text) - template display name
      - `description` (text) - template description
      - `default_result` (text) - default result value
      - `measured_value_fields` (jsonb) - array of {key, label, unit} for measured values
      - `default_description` (text) - pre-filled description text
      - `default_findings` (text) - pre-filled findings text
      - `default_recommendations` (text) - pre-filled recommendations
      - `is_active` (boolean) - whether template is available for use
      - `sort_order` (integer) - display ordering
      - `created_at` / `updated_at` timestamps

    - `protocol_template_items`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK -> protocol_templates)
      - `label` (text) - checklist item label
      - `sort_order` (integer) - display ordering

  2. Security
    - RLS enabled on both tables
    - Policies for authenticated org members
*/

CREATE TABLE IF NOT EXISTS protocol_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  protocol_type text NOT NULL DEFAULT 'other',
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  default_result text NOT NULL DEFAULT 'pass',
  measured_value_fields jsonb NOT NULL DEFAULT '[]',
  default_description text NOT NULL DEFAULT '',
  default_findings text NOT NULL DEFAULT '',
  default_recommendations text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protocol_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view protocol templates"
  ON protocol_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert protocol templates"
  ON protocol_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update protocol templates"
  ON protocol_templates FOR UPDATE
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

CREATE POLICY "Org members can delete protocol templates"
  ON protocol_templates FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- template checklist items
CREATE TABLE IF NOT EXISTS protocol_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES protocol_templates(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE protocol_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view template items"
  ON protocol_template_items FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT pt.id FROM protocol_templates pt
      WHERE pt.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can insert template items"
  ON protocol_template_items FOR INSERT
  TO authenticated
  WITH CHECK (
    template_id IN (
      SELECT pt.id FROM protocol_templates pt
      WHERE pt.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can update template items"
  ON protocol_template_items FOR UPDATE
  TO authenticated
  USING (
    template_id IN (
      SELECT pt.id FROM protocol_templates pt
      WHERE pt.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT pt.id FROM protocol_templates pt
      WHERE pt.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can delete template items"
  ON protocol_template_items FOR DELETE
  TO authenticated
  USING (
    template_id IN (
      SELECT pt.id FROM protocol_templates pt
      WHERE pt.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- auto-set org_id from user's membership
CREATE OR REPLACE FUNCTION set_protocol_template_org_id()
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_protocol_template_org_id ON protocol_templates;
CREATE TRIGGER trg_set_protocol_template_org_id
  BEFORE INSERT ON protocol_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_protocol_template_org_id();
