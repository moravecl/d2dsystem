/*
  # Add org_id trigger to bank_accounts

  The bank_accounts table was missing the set_org_id trigger that automatically
  fills org_id from the user's organization membership on INSERT.
  Without this trigger, inserts fail with RLS violation because org_id is NOT NULL
  and the RLS WITH CHECK policy validates against it.

  Changes:
  - Adds set_org_id trigger on bank_accounts using existing set_organization_id() function
*/

CREATE TRIGGER set_org_id
  BEFORE INSERT ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();
