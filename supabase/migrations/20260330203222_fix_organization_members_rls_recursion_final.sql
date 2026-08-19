
/*
  # Fix organization_members RLS infinite recursion - Final Fix

  ## Problem
  The SELECT policy on organization_members queries organization_members itself,
  causing infinite recursion. The is_org_member_admin function also queries 
  organization_members, compounding the problem.

  ## Solution
  1. Drop all existing organization_members policies
  2. Recreate them using SECURITY DEFINER helper functions that bypass RLS
  3. Fix get_my_organization_id to be reliable
*/

-- Step 1: Create a bypass function that reads organization_members without RLS
CREATE OR REPLACE FUNCTION public.get_user_org_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = p_user_id;
$$;

-- Step 2: Fix get_my_organization_id using the bypass function
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Step 3: Fix is_org_member_admin to use bypass (it's already SECURITY DEFINER, should be OK)
-- But let's make sure it doesn't trigger RLS on itself
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

-- Step 4: Drop all existing policies on organization_members
DROP POLICY IF EXISTS "Members can view org membership" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as owner" ON organization_members;
DROP POLICY IF EXISTS "Superadmins can view all organization members" ON organization_members;

-- Step 5: Recreate policies using the bypass function to avoid recursion
CREATE POLICY "Members can view org membership"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

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

CREATE POLICY "Superadmins can view all organization members"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE superadmins.user_id = auth.uid()));
