
/*
  # Add org_id trigger to bank_transactions

  The bank_transactions table has org_id as NOT NULL but was missing the
  set_org_id trigger that automatically fills org_id from the user's
  organization membership. This caused all insert operations to fail.

  Changes:
  - Adds the set_org_id trigger (using existing set_organization_id() function)
    to the bank_transactions table on INSERT
*/

CREATE TRIGGER set_org_id
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();
