/*
  # Fix service_protocols and service_work_items org isolation

  ## Problem
  Both tables use USING (auth.uid() IS NOT NULL) — any authenticated user
  can read protocols from all organisations.

  ## Solution
  1. Add organization_id to service_protocols
  2. Backfill from parent: project → organization_id, or schedule → project → organization_id
  3. Add auto-trigger so new rows always get org_id set
  4. Replace open policies with org-scoped policies
  5. service_work_items are children of service_protocols → filter via JOIN
*/

-- ============================================================
-- 1. Add organization_id to service_protocols
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_protocols' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE service_protocols ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Backfill: prefer project_id, fall back to schedule → project
-- ============================================================
UPDATE service_protocols sp
SET organization_id = p.organization_id
FROM projects p
WHERE sp.project_id = p.id
  AND sp.organization_id IS NULL;

UPDATE service_protocols sp
SET organization_id = p.organization_id
FROM service_schedules ss
JOIN projects p ON p.id = ss.project_id
WHERE sp.schedule_id = ss.id
  AND sp.organization_id IS NULL;

-- Fall back to creator's org for any remaining rows
UPDATE service_protocols sp
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = sp.created_by
  AND sp.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_protocols_org_id ON service_protocols(organization_id);

-- ============================================================
-- 3. Auto-trigger: new protocols inherit org from project or creator
-- ============================================================
CREATE OR REPLACE FUNCTION set_service_protocol_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try from project
  IF NEW.project_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM projects WHERE id = NEW.project_id;
  END IF;

  -- Try from schedule if still null
  IF NEW.organization_id IS NULL AND NEW.schedule_id IS NOT NULL THEN
    SELECT p.organization_id INTO NEW.organization_id
    FROM service_schedules ss
    JOIN projects p ON p.id = ss.project_id
    WHERE ss.id = NEW.schedule_id;
  END IF;

  -- Final fallback: creator's org
  IF NEW.organization_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM organization_members
    WHERE user_id = NEW.created_by
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_service_protocol_org_id ON service_protocols;
CREATE TRIGGER trg_set_service_protocol_org_id
  BEFORE INSERT ON service_protocols
  FOR EACH ROW EXECUTE FUNCTION set_service_protocol_org_id();

-- ============================================================
-- 4. Replace open RLS policies on service_protocols
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read service protocols" ON service_protocols;
DROP POLICY IF EXISTS "Authenticated users can insert service protocols" ON service_protocols;
DROP POLICY IF EXISTS "Authenticated users can update service protocols" ON service_protocols;
DROP POLICY IF EXISTS "Authenticated users can delete service protocols" ON service_protocols;
DROP POLICY IF EXISTS "Org members can view service protocols" ON service_protocols;
DROP POLICY IF EXISTS "Org members can insert service protocols" ON service_protocols;
DROP POLICY IF EXISTS "Org members can update service protocols" ON service_protocols;
DROP POLICY IF EXISTS "Org members can delete service protocols" ON service_protocols;

CREATE POLICY "Org members can view service protocols"
  ON service_protocols FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org members can insert service protocols"
  ON service_protocols FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update service protocols"
  ON service_protocols FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete service protocols"
  ON service_protocols FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- Superadmins can view all
CREATE POLICY "Superadmins can view all service protocols"
  ON service_protocols FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()));

-- ============================================================
-- 5. Replace open RLS policies on service_work_items
--    (child table — filter via parent protocol's org)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read service work items" ON service_work_items;
DROP POLICY IF EXISTS "Authenticated users can insert service work items" ON service_work_items;
DROP POLICY IF EXISTS "Authenticated users can update service work items" ON service_work_items;
DROP POLICY IF EXISTS "Authenticated users can delete service work items" ON service_work_items;
DROP POLICY IF EXISTS "Org members can view service work items" ON service_work_items;
DROP POLICY IF EXISTS "Org members can insert service work items" ON service_work_items;
DROP POLICY IF EXISTS "Org members can update service work items" ON service_work_items;
DROP POLICY IF EXISTS "Org members can delete service work items" ON service_work_items;

CREATE POLICY "Org members can view service work items"
  ON service_work_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_protocols sp
      WHERE sp.id = service_work_items.protocol_id
        AND sp.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can insert service work items"
  ON service_work_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_protocols sp
      WHERE sp.id = service_work_items.protocol_id
        AND sp.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can update service work items"
  ON service_work_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_protocols sp
      WHERE sp.id = service_work_items.protocol_id
        AND sp.organization_id = get_my_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_protocols sp
      WHERE sp.id = service_work_items.protocol_id
        AND sp.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can delete service work items"
  ON service_work_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_protocols sp
      WHERE sp.id = service_work_items.protocol_id
        AND sp.organization_id = get_my_organization_id()
    )
  );
