/*
  # Add organization_id auto-triggers to inquiry_forms and leads

  1. Changes
    - Add BEFORE INSERT trigger on `inquiry_forms` to auto-set organization_id
    - Add BEFORE INSERT trigger on `leads` to auto-set organization_id
    - These match the pattern used by all other org-scoped tables

  2. Why
    - Application code does not explicitly pass organization_id on insert
    - The `set_organization_id()` trigger function fills it from the user's profile
    - RLS then validates the value matches the user's org
*/

CREATE TRIGGER set_inquiry_forms_org_id
  BEFORE INSERT ON inquiry_forms
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_leads_org_id
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();
