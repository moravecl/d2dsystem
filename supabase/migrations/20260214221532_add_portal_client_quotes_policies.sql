/*
  # Allow portal clients to access project quotes and approvals

  1. Security Changes
    - Add SELECT policy on `project_quotes` for client users
      - Allows authenticated users with role 'client' to view quotes
        for projects assigned to their client_id
    - Add UPDATE policy on `project_quotes` for client users
      - Allows clients to update quote status (approve/return)
    - Add SELECT policy on `quote_approvals` for client users
      - Allows clients to view approvals for their project quotes

  2. Important Notes
    - All policies verify the user's client_id via the profiles table
    - Ensures portal users can view and interact with quotes
*/

CREATE POLICY "Clients can view their project quotes"
  ON project_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = project_quotes.project_id
        AND pr.role = 'client'
        AND pr.client_id = p.client_id
    )
  );

CREATE POLICY "Clients can update their project quotes"
  ON project_quotes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = project_quotes.project_id
        AND pr.role = 'client'
        AND pr.client_id = p.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = project_quotes.project_id
        AND pr.role = 'client'
        AND pr.client_id = p.client_id
    )
  );

CREATE POLICY "Clients can view their quote approvals"
  ON quote_approvals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM project_quotes pq
      JOIN projects p ON p.id = pq.project_id
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE pq.id = quote_approvals.quote_id
        AND pr.role = 'client'
        AND pr.client_id = p.client_id
    )
  );
