/*
  # Add hidden custom field sections per project

  1. New Tables
    - `project_hidden_sections`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `section_name` (text, the section label to hide)
      - `organization_id` (uuid, FK to organizations)
      - `created_at` (timestamptz)
      - UNIQUE(project_id, section_name)

  2. Security
    - Enable RLS on `project_hidden_sections`
    - Org members can select hidden sections for their org projects
    - Org members can insert/delete hidden sections for their org projects
*/

CREATE TABLE IF NOT EXISTS project_hidden_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_name text NOT NULL DEFAULT '',
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, section_name)
);

ALTER TABLE project_hidden_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read hidden sections"
  ON project_hidden_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = project_hidden_sections.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert hidden sections"
  ON project_hidden_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = project_hidden_sections.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete hidden sections"
  ON project_hidden_sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = project_hidden_sections.organization_id
        AND om.user_id = auth.uid()
    )
  );
