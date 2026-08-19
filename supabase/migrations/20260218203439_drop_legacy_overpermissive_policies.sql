/*
  # Drop all legacy over-permissive policies

  ## Problem
  Every table has both a correct org-scoped policy AND an old legacy policy
  that allows any authenticated user to see all data. Because RLS uses OR
  between policies, the legacy policy bypasses org isolation entirely.

  ## Fix
  Drop all legacy "Authenticated users can ..." and similar org-unscoped
  SELECT, INSERT, UPDATE, DELETE policies. The org-scoped policies remain.
*/

-- assets
DROP POLICY IF EXISTS "Authenticated users can view assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can update assets" ON assets;
DROP POLICY IF EXISTS "Admins can delete assets" ON assets;

-- attendance_records
DROP POLICY IF EXISTS "Authenticated users can view all attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can insert attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can update attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can delete attendance records" ON attendance_records;

-- financial_entries
DROP POLICY IF EXISTS "Authenticated users can view financial entries" ON financial_entries;
DROP POLICY IF EXISTS "Authenticated users can insert financial entries" ON financial_entries;

-- invoices
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;

-- received_invoices
DROP POLICY IF EXISTS "Authenticated users can view received invoices" ON received_invoices;
DROP POLICY IF EXISTS "Authenticated users can insert received invoices" ON received_invoices;

-- service_schedules
DROP POLICY IF EXISTS "Authenticated users can read service schedules" ON service_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert service schedules" ON service_schedules;

-- service_tickets
DROP POLICY IF EXISTS "Authenticated users can read service tickets" ON service_tickets;
DROP POLICY IF EXISTS "Authenticated users can insert service tickets" ON service_tickets;

-- suppliers
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON suppliers;

-- tasks
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON tasks;

-- time_entries
DROP POLICY IF EXISTS "Authenticated users can read time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;

-- viceprace
DROP POLICY IF EXISTS "Authenticated users can view viceprace" ON viceprace;
DROP POLICY IF EXISTS "Authenticated users can insert viceprace" ON viceprace;

-- warehouse_items
DROP POLICY IF EXISTS "Authenticated users can read warehouse items" ON warehouse_items;
DROP POLICY IF EXISTS "Authenticated users can insert warehouse items" ON warehouse_items;

-- jobs (legacy without org scope)
DROP POLICY IF EXISTS "Project owners can view jobs" ON jobs;
DROP POLICY IF EXISTS "Project owners can insert jobs" ON jobs;

-- email_log
DROP POLICY IF EXISTS "Authenticated users can insert email log" ON email_log;

-- asset sub-tables
DROP POLICY IF EXISTS "Authenticated users can view asset documents" ON asset_documents;
DROP POLICY IF EXISTS "Authenticated users can view asset events" ON asset_events;
DROP POLICY IF EXISTS "Authenticated users can view due items" ON due_items;
DROP POLICY IF EXISTS "Authenticated users can update due items" ON due_items;
DROP POLICY IF EXISTS "Admins can delete asset documents" ON asset_documents;
DROP POLICY IF EXISTS "Admins can delete asset events" ON asset_events;
DROP POLICY IF EXISTS "Admins can update any asset event" ON asset_events;
DROP POLICY IF EXISTS "Admins can delete due items" ON due_items;
