/*
  # Create template folders table

  1. New Tables
    - `template_folders`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to project_templates)
      - `parent_id` (uuid, self-referencing FK for nested folders)
      - `name` (text) - folder name
      - `sort_order` (integer) - ordering within parent
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `template_folders` table
    - Policies scoped to organization membership via template ownership

  3. Purpose
    - Allows project templates to define a folder hierarchy
    - When a project is created from a template, these folders are auto-created as project_folders
*/

CREATE TABLE IF NOT EXISTS template_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES template_folders(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_folders_template_id ON template_folders(template_id);
CREATE INDEX IF NOT EXISTS idx_template_folders_parent_id ON template_folders(parent_id);

ALTER TABLE template_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read template folders"
  ON template_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_templates pt
      JOIN organization_members om ON om.organization_id = pt.organization_id
      WHERE pt.id = template_folders.template_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert template folders"
  ON template_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_templates pt
      JOIN organization_members om ON om.organization_id = pt.organization_id
      WHERE pt.id = template_folders.template_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can update template folders"
  ON template_folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_templates pt
      JOIN organization_members om ON om.organization_id = pt.organization_id
      WHERE pt.id = template_folders.template_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_templates pt
      JOIN organization_members om ON om.organization_id = pt.organization_id
      WHERE pt.id = template_folders.template_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can delete template folders"
  ON template_folders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_templates pt
      JOIN organization_members om ON om.organization_id = pt.organization_id
      WHERE pt.id = template_folders.template_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );
