/*
  # Fix get_my_organization_id recursion

  ## Problem
  get_my_organization_id() queries organization_members, but organization_members
  has a SELECT RLS policy that calls is_org_member(), which also queries
  organization_members — causing infinite recursion and failing updates on
  tables like company_info that use this function in their policies.

  ## Fix
  Recreate get_my_organization_id() as SECURITY DEFINER so it bypasses RLS
  when querying organization_members, breaking the recursion.
*/

CREATE OR REPLACE FUNCTION get_my_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
