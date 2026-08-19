/*
  # Fix remaining cross-org data leaks

  ## Changes
  1. employee_certifications - add org_id, replace global policies with org-scoped
  2. company_info - remove legacy "allow all authenticated" SELECT policy
  3. smtp_accounts - remove legacy "allow all authenticated" SELECT/INSERT/UPDATE/DELETE policies
  4. warehouse_items - remove legacy "auth.uid() IS NOT NULL" policies
*/

-- ============================================================
-- 1. EMPLOYEE_CERTIFICATIONS - add org scope via profile lookup
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_certifications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE employee_certifications ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Backfill from profile's org membership
UPDATE employee_certifications ec
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = ec.profile_id
  AND ec.organization_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can read certifications" ON employee_certifications;
DROP POLICY IF EXISTS "Authenticated users can insert certifications" ON employee_certifications;
DROP POLICY IF EXISTS "Authenticated users can update certifications" ON employee_certifications;
DROP POLICY IF EXISTS "Authenticated users can delete certifications" ON employee_certifications;
DROP POLICY IF EXISTS "Org members can view employee certifications" ON employee_certifications;
DROP POLICY IF EXISTS "Org members can insert employee certifications" ON employee_certifications;
DROP POLICY IF EXISTS "Org members can update employee certifications" ON employee_certifications;
DROP POLICY IF EXISTS "Org members can delete employee certifications" ON employee_certifications;

CREATE POLICY "Org members can view employee certifications"
  ON employee_certifications FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org members can insert employee certifications"
  ON employee_certifications FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update employee certifications"
  ON employee_certifications FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete employee certifications"
  ON employee_certifications FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

DROP TRIGGER IF EXISTS set_org_id ON employee_certifications;
CREATE TRIGGER set_org_id
  BEFORE INSERT ON employee_certifications
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- ============================================================
-- 2. COMPANY_INFO - remove legacy global SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to read company info" ON company_info;
DROP POLICY IF EXISTS "Allow admins to update company info" ON company_info;

-- ============================================================
-- 3. SMTP_ACCOUNTS - remove legacy global policies
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view SMTP accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Admins can insert SMTP accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Admins can update SMTP accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Admins can delete SMTP accounts" ON smtp_accounts;

-- ============================================================
-- 4. WAREHOUSE_ITEMS - remove legacy global policies
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete warehouse items" ON warehouse_items;
DROP POLICY IF EXISTS "Authenticated users can update warehouse items" ON warehouse_items;
