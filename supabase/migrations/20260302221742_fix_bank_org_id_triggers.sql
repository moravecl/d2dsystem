/*
  # Fix bank tables org_id triggers

  The bank_accounts and bank_transactions tables use the column name `org_id`
  (not `organization_id` like other tables). The existing `set_organization_id()`
  trigger function sets `NEW.organization_id` which does not exist on these tables,
  so the org_id remains NULL and RLS WITH CHECK fails on INSERT.

  Changes:
  - Creates a new trigger function `set_org_id_field()` that sets NEW.org_id
  - Replaces the existing set_org_id triggers on bank_accounts and bank_transactions
    with ones using the correct function
*/

CREATE OR REPLACE FUNCTION set_org_id_field()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_my_organization_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_org_id ON bank_accounts;
CREATE TRIGGER set_org_id
  BEFORE INSERT ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_org_id_field();

DROP TRIGGER IF EXISTS set_org_id ON bank_transactions;
CREATE TRIGGER set_org_id
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION set_org_id_field();
