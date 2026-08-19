/*
  # Backfill organization_id on all existing data rows

  ## Problem
  RLS SELECT policies have `OR organization_id IS NULL` which allows any authenticated
  user (including freshly registered strangers) to read all legacy data that has no
  organization_id set yet. This is a critical data isolation bug.

  ## Fix
  Assign the HouseSmart organization_id to every existing row in all business tables
  where organization_id is currently NULL. After this, the `OR organization_id IS NULL`
  clause will match nothing for real data, and we can safely drop it.
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'housesmart' LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'HouseSmart organization not found';
  END IF;

  UPDATE clients           SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE projects          SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE invoices          SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE received_invoices SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE suppliers         SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE assets            SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE warehouse_items   SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE tasks             SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE time_entries      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE jobs              SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE service_tickets   SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE service_schedules SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE smtp_accounts     SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE company_info      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE attendance_records SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE viceprace         SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE financial_entries SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE email_log         SET organization_id = v_org_id WHERE organization_id IS NULL;
END $$;
