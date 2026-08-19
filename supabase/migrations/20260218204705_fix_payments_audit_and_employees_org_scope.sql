/*
  # Fix payments, audit_log, employees, and profiles org isolation

  ## Changes
  1. payments - no organization_id column, filter via invoices join
  2. audit_log - no organization_id column, filter via user membership
  3. employees - add organization_id column
  4. profiles - "Admins can read all profiles" lets any admin see ALL org profiles

  ## Fix
  - Drop over-permissive policies
  - Create org-scoped policies via joins where no organization_id exists
  - Add organization_id to employees and populate from org_members
*/

-- ============================================================
-- 1. PAYMENTS - filter via invoices which has organization_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read payments" ON payments;

CREATE POLICY "Org members can view payments"
  ON payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.organization_id = get_my_organization_id()
    )
  );

-- ============================================================
-- 2. AUDIT LOG - filter by organization membership
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read audit log" ON audit_log;
DROP POLICY IF EXISTS "Org members can view audit log" ON audit_log;

CREATE POLICY "Org members can view audit log"
  ON audit_log FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = get_my_organization_id()
    )
  );

-- ============================================================
-- 3. EMPLOYEES - add organization_id
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Backfill: set organization_id from the user's org membership
UPDATE employees e
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = e.user_id
  AND e.organization_id IS NULL;

-- Drop old policies
DROP POLICY IF EXISTS "Admins can manage employees" ON employees;
DROP POLICY IF EXISTS "Admins can update employees" ON employees;
DROP POLICY IF EXISTS "Admins can delete employees" ON employees;
DROP POLICY IF EXISTS "Org members can view employees" ON employees;
DROP POLICY IF EXISTS "Org admins can insert employees" ON employees;
DROP POLICY IF EXISTS "Org admins can update employees" ON employees;
DROP POLICY IF EXISTS "Org admins can delete employees" ON employees;

CREATE POLICY "Org members can view employees"
  ON employees FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can insert employees"
  ON employees FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can update employees"
  ON employees FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org admins can delete employees"
  ON employees FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- ============================================================
-- 4. PROFILES - "Admins can read all profiles" sees all orgs
-- ============================================================
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Org admins can read org profiles" ON profiles;

-- Admins can only read profiles within their own org
CREATE POLICY "Org admins can read org profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR
    id IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = get_my_organization_id()
    )
  );
