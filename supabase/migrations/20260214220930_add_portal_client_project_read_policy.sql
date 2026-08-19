/*
  # Allow portal clients to read their projects

  1. Security Changes
    - Add SELECT policy on `projects` table for authenticated users with role 'client'
    - Policy checks that the project's `client_id` matches the user's `client_id` from profiles
    - This enables the client portal to display projects assigned to the client
*/

CREATE POLICY "Clients can view their assigned projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'client'
        AND profiles.client_id = projects.client_id
    )
  );
