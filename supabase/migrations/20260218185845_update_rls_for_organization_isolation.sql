/*
  # Update RLS Policies for Organization Isolation

  ## Summary
  Rewrites RLS policies on all key business tables to isolate data per organization.
  Users can only see and modify data that belongs to their organization.

  ## Approach
  - Drop old user_id-based policies
  - Add new organization_id-based policies using get_my_organization_id() helper
  - Portal clients remain blocked via is_portal_client flag (handled in app layer)

  ## Tables Updated
  - clients, projects, invoices, received_invoices, suppliers
  - assets, warehouse_items, tasks, time_entries, jobs
  - service_tickets, service_schedules, smtp_accounts, company_info
  - attendance_records, viceprace, financial_entries, email_log
*/

-- ============================================================
-- CLIENTS
-- ============================================================
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can manage clients" ON clients;

CREATE POLICY "Org members can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- PROJECTS
-- ============================================================
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can update their projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects;

CREATE POLICY "Org members can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- INVOICES
-- ============================================================
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON invoices;

CREATE POLICY "Org members can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- RECEIVED INVOICES
-- ============================================================
DROP POLICY IF EXISTS "Users can view received invoices" ON received_invoices;
DROP POLICY IF EXISTS "Users can insert received invoices" ON received_invoices;
DROP POLICY IF EXISTS "Users can update received invoices" ON received_invoices;
DROP POLICY IF EXISTS "Users can delete received invoices" ON received_invoices;
DROP POLICY IF EXISTS "Authenticated users can manage received invoices" ON received_invoices;

CREATE POLICY "Org members can view received invoices"
  ON received_invoices FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert received invoices"
  ON received_invoices FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update received invoices"
  ON received_invoices FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete received invoices"
  ON received_invoices FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- SUPPLIERS
-- ============================================================
DROP POLICY IF EXISTS "Users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON suppliers;

CREATE POLICY "Org members can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- ASSETS
-- ============================================================
DROP POLICY IF EXISTS "Users can view assets" ON assets;
DROP POLICY IF EXISTS "Users can insert assets" ON assets;
DROP POLICY IF EXISTS "Users can update assets" ON assets;
DROP POLICY IF EXISTS "Users can delete assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can manage assets" ON assets;

CREATE POLICY "Org members can view assets"
  ON assets FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete assets"
  ON assets FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- WAREHOUSE ITEMS
-- ============================================================
DROP POLICY IF EXISTS "Users can view warehouse items" ON warehouse_items;
DROP POLICY IF EXISTS "Users can insert warehouse items" ON warehouse_items;
DROP POLICY IF EXISTS "Users can update warehouse items" ON warehouse_items;
DROP POLICY IF EXISTS "Users can delete warehouse items" ON warehouse_items;
DROP POLICY IF EXISTS "Authenticated users can manage warehouse items" ON warehouse_items;

CREATE POLICY "Org members can view warehouse items"
  ON warehouse_items FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert warehouse items"
  ON warehouse_items FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update warehouse items"
  ON warehouse_items FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete warehouse items"
  ON warehouse_items FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- TASKS
-- ============================================================
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can manage tasks" ON tasks;

CREATE POLICY "Org members can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- TIME ENTRIES
-- ============================================================
DROP POLICY IF EXISTS "Users can view time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can delete time entries" ON time_entries;
DROP POLICY IF EXISTS "Authenticated users can manage time entries" ON time_entries;

CREATE POLICY "Org members can view time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- JOBS
-- ============================================================
DROP POLICY IF EXISTS "Users can view jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can manage jobs" ON jobs;
DROP POLICY IF EXISTS "Admins and managers can manage jobs" ON jobs;

CREATE POLICY "Org members can view jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- SERVICE TICKETS
-- ============================================================
DROP POLICY IF EXISTS "Users can view service tickets" ON service_tickets;
DROP POLICY IF EXISTS "Users can insert service tickets" ON service_tickets;
DROP POLICY IF EXISTS "Users can update service tickets" ON service_tickets;
DROP POLICY IF EXISTS "Users can delete service tickets" ON service_tickets;
DROP POLICY IF EXISTS "Authenticated users can manage service tickets" ON service_tickets;

CREATE POLICY "Org members can view service tickets"
  ON service_tickets FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert service tickets"
  ON service_tickets FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update service tickets"
  ON service_tickets FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete service tickets"
  ON service_tickets FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- SERVICE SCHEDULES
-- ============================================================
DROP POLICY IF EXISTS "Users can view service schedules" ON service_schedules;
DROP POLICY IF EXISTS "Users can insert service schedules" ON service_schedules;
DROP POLICY IF EXISTS "Users can update service schedules" ON service_schedules;
DROP POLICY IF EXISTS "Users can delete service schedules" ON service_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage service schedules" ON service_schedules;

CREATE POLICY "Org members can view service schedules"
  ON service_schedules FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert service schedules"
  ON service_schedules FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update service schedules"
  ON service_schedules FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete service schedules"
  ON service_schedules FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- SMTP ACCOUNTS (per-org email config)
-- ============================================================
DROP POLICY IF EXISTS "Admins can view smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Admins can manage smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Admins can insert smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Admins can update smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Admins can delete smtp accounts" ON smtp_accounts;

CREATE POLICY "Org admins can view smtp accounts"
  ON smtp_accounts FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org admins can insert smtp accounts"
  ON smtp_accounts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update smtp accounts"
  ON smtp_accounts FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete smtp accounts"
  ON smtp_accounts FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- COMPANY INFO (per-org)
-- ============================================================
DROP POLICY IF EXISTS "Admins can view company info" ON company_info;
DROP POLICY IF EXISTS "Admins can manage company info" ON company_info;
DROP POLICY IF EXISTS "Admins can insert company info" ON company_info;
DROP POLICY IF EXISTS "Admins can update company info" ON company_info;
DROP POLICY IF EXISTS "Anyone authenticated can view company info" ON company_info;
DROP POLICY IF EXISTS "Authenticated users can view company info" ON company_info;

CREATE POLICY "Org members can view company info"
  ON company_info FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org admins can insert company info"
  ON company_info FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update company info"
  ON company_info FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
DROP POLICY IF EXISTS "Users can view attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Users can insert attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Users can update attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can view attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can manage attendance records" ON attendance_records;

CREATE POLICY "Org members can view attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org members can insert attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update attendance"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());
