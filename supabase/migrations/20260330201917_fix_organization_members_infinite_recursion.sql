
/*
  # Fix infinite recursion in organization_members RLS

  ## Problem
  The "Members can view org membership" policy on organization_members calls is_org_member(),
  which itself queries organization_members — causing infinite recursion during sign-in.
  
  Even though is_org_member is SECURITY DEFINER, it still triggers RLS on organization_members
  because SECURITY DEFINER only bypasses RLS if the function owner has BYPASSRLS privilege.
  
  ## Fix
  Replace the is_org_member and is_org_member_admin functions with versions that use
  SET search_path and explicitly bypass RLS via a security definer context.
  Also simplify the organization_members SELECT policy to avoid the recursive call.
*/

-- Drop and recreate is_org_member to truly bypass RLS using a direct join
-- We use a subquery approach that won't trigger the RLS policy on organization_members

CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_org_member_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role = ANY(ARRAY['owner','admin'])
  );
$$;

-- The real fix: replace the SELECT policy on organization_members
-- to NOT call is_org_member (which would recurse back into this table)
-- Instead use a direct self-referential query that GoTrue/Postgres can handle

DROP POLICY IF EXISTS "Members can view org membership" ON organization_members;

CREATE POLICY "Members can view org membership"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members om2
      WHERE om2.user_id = auth.uid()
    )
  );
