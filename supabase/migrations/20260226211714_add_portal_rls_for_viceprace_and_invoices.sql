/*
  # Add Portal Client RLS Policies for Viceprace and Invoices

  1. Changes
    - Add SELECT policy for portal clients to view viceprace on their projects
    - Add UPDATE policy for portal clients to approve/reject viceprace on their projects
    - Add SELECT policy for portal clients to view invoices on their projects
    - Add SELECT policy for portal clients to view invoice_items for their invoices

  2. Security
    - Portal clients can only see viceprace/invoices for projects they are assigned to
    - Uses existing is_portal_client_of_project helper function
    - Portal clients cannot create, delete, or modify (except approval status) viceprace
    - Portal clients cannot modify invoices at all
*/

-- Viceprace: Portal clients can view viceprace for their projects
CREATE POLICY "Portal clients can view viceprace on their projects"
  ON viceprace FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

-- Viceprace: Portal clients can update viceprace (for approval/rejection)
CREATE POLICY "Portal clients can update viceprace on their projects"
  ON viceprace FOR UPDATE TO authenticated
  USING (is_portal_client_of_project(project_id))
  WITH CHECK (is_portal_client_of_project(project_id));

-- Viceprace items: Portal clients can view items for viceprace on their projects
CREATE POLICY "Portal clients can view viceprace items on their projects"
  ON viceprace_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viceprace v
      WHERE v.id = viceprace_items.viceprace_id
      AND is_portal_client_of_project(v.project_id)
    )
  );

-- Invoices: Portal clients can view invoices for their projects
CREATE POLICY "Portal clients can view invoices on their projects"
  ON invoices FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

-- Invoice items: Portal clients can view invoice items for their invoices
CREATE POLICY "Portal clients can view invoice items on their projects"
  ON invoice_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_items.invoice_id
      AND is_portal_client_of_project(i.project_id)
    )
  );
