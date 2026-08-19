/*
  # Fix employee_equipment org isolation

  ## Changes
  - Add organization_id column to employee_equipment
  - Backfill from profile's org membership
  - Replace global "authenticated" policies with org-scoped policies
  - Add trigger to auto-set org_id on insert
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_equipment' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE employee_equipment ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

UPDATE employee_equipment ee
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = ee.profile_id
  AND ee.organization_id IS NULL;

DROP POLICY IF EXISTS "Authenticated users can read equipment" ON employee_equipment;
DROP POLICY IF EXISTS "Authenticated users can insert equipment" ON employee_equipment;
DROP POLICY IF EXISTS "Authenticated users can update equipment" ON employee_equipment;
DROP POLICY IF EXISTS "Authenticated users can delete equipment" ON employee_equipment;
DROP POLICY IF EXISTS "Org members can view employee equipment" ON employee_equipment;
DROP POLICY IF EXISTS "Org members can insert employee equipment" ON employee_equipment;
DROP POLICY IF EXISTS "Org members can update employee equipment" ON employee_equipment;
DROP POLICY IF EXISTS "Org members can delete employee equipment" ON employee_equipment;

CREATE POLICY "Org members can view employee equipment"
  ON employee_equipment FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org members can insert employee equipment"
  ON employee_equipment FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update employee equipment"
  ON employee_equipment FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete employee equipment"
  ON employee_equipment FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

DROP TRIGGER IF EXISTS set_org_id ON employee_equipment;
CREATE TRIGGER set_org_id
  BEFORE INSERT ON employee_equipment
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();
