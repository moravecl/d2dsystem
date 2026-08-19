/*
  # Fix Portal Remarks RLS - Security Definer Helper

  1. Problem
    - Portal users cannot insert into project_remarks or project_remark_comments
    - The existing RLS INSERT policies use EXISTS subqueries that join projects -> clients
    - The clients table has its own RLS (org members only), which blocks portal users
    - This causes the EXISTS check to always return false for portal users

  2. Solution
    - Create a SECURITY DEFINER function that checks portal ownership bypassing nested RLS
    - Drop and recreate the portal INSERT/SELECT policies using the new function

  3. Security
    - The helper function only returns a boolean (no data leak)
    - It verifies the caller's auth.uid() matches the client's portal_user_id
    - Used only in RLS policies, not exposed to end users
*/

-- Helper: check if current user is the portal client for a given project
CREATE OR REPLACE FUNCTION is_portal_client_of_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = p_project_id
    AND c.portal_user_id = auth.uid()
  );
$$;

-- Helper: check if current user is the portal client for a remark's project
CREATE OR REPLACE FUNCTION is_portal_client_of_remark(p_remark_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_remarks pr
    JOIN projects p ON p.id = pr.project_id
    JOIN clients c ON c.id = p.client_id
    WHERE pr.id = p_remark_id
    AND c.portal_user_id = auth.uid()
  );
$$;

-- Drop old portal policies for project_remarks
DROP POLICY IF EXISTS "Portal clients can read remarks on their projects" ON project_remarks;
DROP POLICY IF EXISTS "Portal clients can create remarks on their projects" ON project_remarks;

-- Recreate using SECURITY DEFINER helpers
CREATE POLICY "Portal clients can read remarks on their projects"
  ON project_remarks FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

CREATE POLICY "Portal clients can create remarks on their projects"
  ON project_remarks FOR INSERT TO authenticated
  WITH CHECK (is_portal_client_of_project(project_id));

-- Drop old portal policies for project_remark_comments
DROP POLICY IF EXISTS "Portal clients can read comments on their project remarks" ON project_remark_comments;
DROP POLICY IF EXISTS "Portal clients can add comments on their project remarks" ON project_remark_comments;

-- Recreate using SECURITY DEFINER helpers
CREATE POLICY "Portal clients can read comments on their project remarks"
  ON project_remark_comments FOR SELECT TO authenticated
  USING (is_portal_client_of_remark(remark_id));

CREATE POLICY "Portal clients can add comments on their project remarks"
  ON project_remark_comments FOR INSERT TO authenticated
  WITH CHECK (is_portal_client_of_remark(remark_id));
