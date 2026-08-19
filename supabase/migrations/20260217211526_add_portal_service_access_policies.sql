/*
  # Portal Access for Service Module

  1. Security Changes
    - Portal users can read installed_devices for their linked projects
    - Portal users can read service_schedules for their linked projects
    - Portal users can read and create service_tickets for their linked projects

  2. Notes
    - Portal users are identified via clients.portal_user_id
    - Access is scoped to projects where client_id matches the portal user's client
*/

-- Portal: read installed devices for own projects
CREATE POLICY "Portal users can read own project devices"
  ON installed_devices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.id = installed_devices.project_id
      AND c.portal_user_id = auth.uid()
    )
  );

-- Portal: read service schedules for own projects
CREATE POLICY "Portal users can read own project schedules"
  ON service_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.id = service_schedules.project_id
      AND c.portal_user_id = auth.uid()
    )
  );

-- Portal: read service tickets for own projects
CREATE POLICY "Portal users can read own project tickets"
  ON service_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.id = service_tickets.project_id
      AND c.portal_user_id = auth.uid()
    )
  );

-- Portal: create service tickets for own projects
CREATE POLICY "Portal users can create tickets for own projects"
  ON service_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    reported_by_portal = true
    AND portal_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.id = service_tickets.project_id
      AND c.portal_user_id = auth.uid()
    )
  );

-- Portal: read service types (needed to display schedule info)
CREATE POLICY "Portal users can read service types"
  ON service_types FOR SELECT
  TO authenticated
  USING (is_active = true);
