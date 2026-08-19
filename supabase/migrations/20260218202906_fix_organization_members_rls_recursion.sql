/*
  # Fix organization_members RLS recursion

  ## Problem
  The "Admins can insert members" policy uses a subquery on organization_members
  itself, causing infinite recursion when inserting the first record (owner).

  ## Fix
  Drop the recursive INSERT policy and replace it with a security-definer
  function that checks membership without triggering RLS on the same table.
  Also fix the SELECT, UPDATE, DELETE policies to use the same function.
*/

CREATE OR REPLACE FUNCTION public.is_org_member_admin(org_id uuid)
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

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
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

DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;
DROP POLICY IF EXISTS "Members can view org membership" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as owner" ON organization_members;

CREATE POLICY "Users can insert themselves as owner"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'owner');

CREATE POLICY "Admins can insert members"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id <> auth.uid()
    AND is_org_member_admin(organization_id)
  );

CREATE POLICY "Members can view org membership"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "Admins can update members"
  ON organization_members
  FOR UPDATE
  TO authenticated
  USING (is_org_member_admin(organization_id))
  WITH CHECK (is_org_member_admin(organization_id));

CREATE POLICY "Admins can delete members"
  ON organization_members
  FOR DELETE
  TO authenticated
  USING (is_org_member_admin(organization_id));
