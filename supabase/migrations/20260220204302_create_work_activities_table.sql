/*
  # Create work activities lookup table

  1. New Tables
    - `work_activities`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `name` (text, activity name e.g. "Elektroinstalace")
      - `color` (text, hex color e.g. "#facc15")
      - `is_active` (boolean, default true)
      - `sort_order` (integer, for ordering)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `work_activities` table
    - Authenticated org members can read activities
    - Admins/managers can insert, update, delete

  3. Seed data
    - Inserts default activities matching current hardcoded list
      for all existing organizations
*/

CREATE TABLE IF NOT EXISTS work_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read work activities"
  ON work_activities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert work activities"
  ON work_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update work activities"
  ON work_activities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete work activities"
  ON work_activities FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

INSERT INTO work_activities (organization_id, name, color, sort_order)
SELECT o.id, v.name, v.color, v.sort_order
FROM organizations o
CROSS JOIN (VALUES
  ('Elektroinstalace', '#facc15', 1),
  ('Vodoinstalace',    '#3b82f6', 2),
  ('Topeni',           '#ef4444', 3),
  ('Rekuperace',       '#22c55e', 4),
  ('SDK prace',        '#64748b', 5),
  ('Bourani',          '#f97316', 6),
  ('Malovani',         '#ec4899', 7),
  ('Montaz',           '#14b8a6', 8),
  ('Uklid',            '#06b6d4', 9),
  ('Priprava',         '#0ea5e9', 10),
  ('Jine',             '#94a3b8', 11)
) AS v(name, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM work_activities wa WHERE wa.organization_id = o.id
);
