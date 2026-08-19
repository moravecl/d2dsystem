/*
  # Fix RLS policy for project_design_elements INSERT

  1. Problem
    - Current INSERT policy checks org_id IN user's org
    - But org_id is NULL at insert time (filled by trigger AFTER policy check)
    - This causes INSERT to fail silently

  2. Solution
    - Change INSERT policy to check project ownership instead
    - User can insert if they can access the project (project belongs to their org)

  3. Security
    - Still secure: user must have access to the project
    - Trigger fills correct org_id from project
*/

DROP POLICY IF EXISTS "Org members can insert project_design_elements" ON project_design_elements;

CREATE POLICY "Users can insert project_design_elements for their projects"
  ON project_design_elements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
