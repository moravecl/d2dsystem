/*
  # Create Project Remarks (Pripominky) Schema

  1. New Tables
    - `project_remarks`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `text` (text, the remark content)
      - `status` (text, 'open' or 'resolved')
      - `created_by` (uuid, references auth.users)
      - `created_by_portal` (boolean, whether created by portal client)
      - `resolved_at` (timestamptz, when resolved)
      - `resolved_by` (uuid, who resolved it)
      - `sort_order` (integer, for ordering)
      - `organization_id` (uuid, references organizations)
      - `created_at` / `updated_at` (timestamptz)

    - `project_remark_comments`
      - `id` (uuid, primary key)
      - `remark_id` (uuid, references project_remarks)
      - `text` (text, comment content)
      - `created_by` (uuid, references auth.users)
      - `created_by_portal` (boolean)
      - `organization_id` (uuid, references organizations)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated org members to CRUD
    - Policies for portal users to create remarks and comments, read own project remarks

  3. Notes
    - Remarks act as a checklist - clients create items, team toggles status
    - Comments enable threaded discussion on each remark
    - Portal clients can create and view remarks on their projects
*/

-- project_remarks table
CREATE TABLE IF NOT EXISTS project_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by uuid REFERENCES auth.users(id),
  created_by_portal boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  sort_order integer NOT NULL DEFAULT 0,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_remarks ENABLE ROW LEVEL SECURITY;

-- project_remark_comments table
CREATE TABLE IF NOT EXISTS project_remark_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remark_id uuid NOT NULL REFERENCES project_remarks(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_by_portal boolean NOT NULL DEFAULT false,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_remark_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_remarks (authenticated org members)
CREATE POLICY "Org members can read project remarks"
  ON project_remarks FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create project remarks"
  ON project_remarks FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update project remarks"
  ON project_remarks FOR UPDATE TO authenticated
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

CREATE POLICY "Org members can delete project remarks"
  ON project_remarks FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- RLS policies for project_remark_comments (authenticated org members)
CREATE POLICY "Org members can read remark comments"
  ON project_remark_comments FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create remark comments"
  ON project_remark_comments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete remark comments"
  ON project_remark_comments FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Portal client policies for project_remarks
CREATE POLICY "Portal clients can read remarks on their projects"
  ON project_remarks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.id = project_remarks.project_id
      AND c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY "Portal clients can create remarks on their projects"
  ON project_remarks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.id = project_remarks.project_id
      AND c.portal_user_id = auth.uid()
    )
  );

-- Portal client policies for project_remark_comments
CREATE POLICY "Portal clients can read comments on their project remarks"
  ON project_remark_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_remarks pr
      JOIN projects p ON p.id = pr.project_id
      JOIN clients c ON c.id = p.client_id
      WHERE pr.id = project_remark_comments.remark_id
      AND c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY "Portal clients can add comments on their project remarks"
  ON project_remark_comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_remarks pr
      JOIN projects p ON p.id = pr.project_id
      JOIN clients c ON c.id = p.client_id
      WHERE pr.id = project_remark_comments.remark_id
      AND c.portal_user_id = auth.uid()
    )
  );

-- Auto-set organization_id triggers
CREATE OR REPLACE FUNCTION set_project_remark_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT p.organization_id FROM projects p WHERE p.id = NEW.project_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_project_remark_org_id
  BEFORE INSERT ON project_remarks
  FOR EACH ROW EXECUTE FUNCTION set_project_remark_org_id();

CREATE OR REPLACE FUNCTION set_remark_comment_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT pr.organization_id FROM project_remarks pr WHERE pr.id = NEW.remark_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_remark_comment_org_id
  BEFORE INSERT ON project_remark_comments
  FOR EACH ROW EXECUTE FUNCTION set_remark_comment_org_id();
