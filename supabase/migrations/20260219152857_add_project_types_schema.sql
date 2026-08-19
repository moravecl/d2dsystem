/*
  # Add Project Types (Ciselnik typu projektu)

  ## Summary
  This migration adds a configurable project type registry and links it to projects via a many-to-many junction table.

  ## New Tables

  ### `project_types`
  Configurable list of project type labels (e.g. FVE, Tepelne cerpadlo, Elektroinstalace).
  - `id` - UUID primary key
  - `organization_id` - FK to organizations (per-org isolation)
  - `name` - Display name of the type
  - `color` - Tailwind color token (e.g. "emerald", "blue", "amber")
  - `is_active` - Whether the type is available for selection
  - `sort_order` - Display order
  - `created_at`

  ### `project_project_types`
  Junction table linking projects to one or more project types (many-to-many).
  - `project_id` - FK to projects
  - `project_type_id` - FK to project_types

  ## Security
  - RLS enabled on both tables
  - Users can only access project_types belonging to their organization
  - Users can only access project_project_types for projects they can see

  ## Seed Data
  Default project types seeded for all existing organizations.
*/

CREATE TABLE IF NOT EXISTS project_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org project types"
  ON project_types FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert project types"
  ON project_types FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update project types"
  ON project_types FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete project types"
  ON project_types FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE TABLE IF NOT EXISTS project_project_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_type_id uuid NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, project_type_id)
);

ALTER TABLE project_project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project type assignments"
  ON project_project_types FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = auth.uid()
         OR responsible_user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM organization_members om
           JOIN projects p ON p.id = project_project_types.project_id
           WHERE om.user_id = auth.uid()
         )
    )
  );

CREATE POLICY "Members can insert project type assignments"
  ON project_project_types FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
    )
    AND project_type_id IN (
      SELECT id FROM project_types WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can delete project type assignments"
  ON project_project_types FOR DELETE
  TO authenticated
  USING (
    project_type_id IN (
      SELECT id FROM project_types WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

INSERT INTO project_types (organization_id, name, color, sort_order)
SELECT id, 'FVE (fotovoltaika)', 'amber', 0 FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO project_types (organization_id, name, color, sort_order)
SELECT id, 'Tepelné čerpadlo', 'red', 1 FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO project_types (organization_id, name, color, sort_order)
SELECT id, 'Elektroinstalace', 'yellow', 2 FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO project_types (organization_id, name, color, sort_order)
SELECT id, 'Rekuperace', 'teal', 3 FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO project_types (organization_id, name, color, sort_order)
SELECT id, 'Vodovod a kanalizace', 'blue', 4 FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO project_types (organization_id, name, color, sort_order)
SELECT id, 'Topení / podlahové topení', 'orange', 5 FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO project_types (organization_id, name, color, sort_order)
SELECT id, 'Klimatizace', 'cyan', 6 FROM organizations
ON CONFLICT DO NOTHING;
