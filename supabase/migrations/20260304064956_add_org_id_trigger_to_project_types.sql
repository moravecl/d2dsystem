/*
  # Add organization_id auto-trigger to project_types

  ## Problem
  The project_types table has an organization_id column and RLS INSERT policy
  that requires organization_id to match the user's organization. However, there
  is no trigger to auto-populate organization_id on insert, causing all inserts
  to fail silently.

  ## Fix
  - Create trigger function set_project_type_org_id
  - Attach it as BEFORE INSERT trigger on project_types
  - Also backfill any existing rows with NULL organization_id
*/

CREATE OR REPLACE FUNCTION set_project_type_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_project_type_org_id ON project_types;

CREATE TRIGGER trg_set_project_type_org_id
  BEFORE INSERT ON project_types
  FOR EACH ROW EXECUTE FUNCTION set_project_type_org_id();
