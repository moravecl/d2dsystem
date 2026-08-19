/*
  # Create design_versions table

  1. New Tables
    - `design_versions`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects, cascade delete)
      - `version_number` (integer) - auto-incremented per project
      - `label` (text) - user-facing version name
      - `description` (text) - optional notes about this version
      - `selection_data` (jsonb) - snapshot of product selections and placements
      - `floorplan_data` (jsonb) - snapshot of floor plans, rooms, cables
      - `created_at` (timestamptz)
      - `created_by` (uuid, FK to auth.users)

  2. Modified Tables
    - `projects`
      - Added `active_design_version_id` (uuid) - reference to the currently viewed version

  3. Security
    - Enable RLS on `design_versions`
    - Authenticated users can read versions for their projects
    - Authenticated users can insert/update/delete their own versions
*/

CREATE TABLE IF NOT EXISTS design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  selection_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  floorplan_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'active_design_version_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN active_design_version_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_design_versions_project_id ON design_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_design_versions_created_at ON design_versions(created_at DESC);

ALTER TABLE design_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read design versions"
  ON design_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = design_versions.project_id
    )
  );

CREATE POLICY "Authenticated users can insert design versions"
  ON design_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update own design versions"
  ON design_versions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete own design versions"
  ON design_versions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
