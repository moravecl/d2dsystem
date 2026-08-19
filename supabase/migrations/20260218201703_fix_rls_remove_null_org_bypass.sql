/*
  # Fix RLS: Remove NULL organization_id bypass

  ## Problem
  All SELECT policies had `OR organization_id IS NULL` which allowed any authenticated
  user to see data without an organization. Now that all data has been backfilled with
  real organization_ids, this bypass must be removed so cross-tenant data leakage
  is impossible.

  ## Changes
  Drops and recreates SELECT policies on all business tables to use strict
  `organization_id = get_my_organization_id()` without the NULL bypass.
*/

-- CLIENTS
DROP POLICY IF EXISTS "Org members can view clients" ON clients;
CREATE POLICY "Org members can view clients"
  ON clients FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- PROJECTS
DROP POLICY IF EXISTS "Org members can view projects" ON projects;
CREATE POLICY "Org members can view projects"
  ON projects FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- INVOICES
DROP POLICY IF EXISTS "Org members can view invoices" ON invoices;
CREATE POLICY "Org members can view invoices"
  ON invoices FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- RECEIVED INVOICES
DROP POLICY IF EXISTS "Org members can view received invoices" ON received_invoices;
CREATE POLICY "Org members can view received invoices"
  ON received_invoices FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- SUPPLIERS
DROP POLICY IF EXISTS "Org members can view suppliers" ON suppliers;
CREATE POLICY "Org members can view suppliers"
  ON suppliers FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- ASSETS
DROP POLICY IF EXISTS "Org members can view assets" ON assets;
CREATE POLICY "Org members can view assets"
  ON assets FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- WAREHOUSE ITEMS
DROP POLICY IF EXISTS "Org members can view warehouse items" ON warehouse_items;
CREATE POLICY "Org members can view warehouse items"
  ON warehouse_items FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- TASKS
DROP POLICY IF EXISTS "Org members can view tasks" ON tasks;
CREATE POLICY "Org members can view tasks"
  ON tasks FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- TIME ENTRIES
DROP POLICY IF EXISTS "Org members can view time entries" ON time_entries;
CREATE POLICY "Org members can view time entries"
  ON time_entries FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- JOBS
DROP POLICY IF EXISTS "Org members can view jobs" ON jobs;
CREATE POLICY "Org members can view jobs"
  ON jobs FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- SERVICE TICKETS
DROP POLICY IF EXISTS "Org members can view service tickets" ON service_tickets;
CREATE POLICY "Org members can view service tickets"
  ON service_tickets FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- SERVICE SCHEDULES
DROP POLICY IF EXISTS "Org members can view service schedules" ON service_schedules;
CREATE POLICY "Org members can view service schedules"
  ON service_schedules FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- SMTP ACCOUNTS
DROP POLICY IF EXISTS "Org admins can view smtp accounts" ON smtp_accounts;
CREATE POLICY "Org admins can view smtp accounts"
  ON smtp_accounts FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- COMPANY INFO
DROP POLICY IF EXISTS "Org members can view company info" ON company_info;
CREATE POLICY "Org members can view company info"
  ON company_info FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- ATTENDANCE RECORDS
DROP POLICY IF EXISTS "Org members can view attendance" ON attendance_records;
CREATE POLICY "Org members can view attendance"
  ON attendance_records FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- VICEPRACE
DROP POLICY IF EXISTS "Org members can view viceprace" ON viceprace;
CREATE POLICY "Org members can view viceprace"
  ON viceprace FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- FINANCIAL ENTRIES
DROP POLICY IF EXISTS "Org members can view financial entries" ON financial_entries;
CREATE POLICY "Org members can view financial entries"
  ON financial_entries FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

-- EMAIL LOG
DROP POLICY IF EXISTS "Org members can view email log" ON email_log;
CREATE POLICY "Org members can view email log"
  ON email_log FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());
