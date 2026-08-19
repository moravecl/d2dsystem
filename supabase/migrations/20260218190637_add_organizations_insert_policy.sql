/*
  # Fix Organizations: Add INSERT policy

  ## Problem
  The `organizations` table was missing an INSERT policy, which caused a 403 RLS
  error when any authenticated user tried to create a new organization during onboarding.

  ## Changes
  1. Adds INSERT policy on `organizations` so any authenticated user can create one
  2. Adds INSERT policy on `organization_members` to allow the first owner row
     to be inserted even before membership exists (bootstrap case)
*/

-- Allow any authenticated user to create an organization
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Allow a user to insert themselves as owner when bootstrapping (no prior membership needed)
-- The existing "Admins can insert members" policy blocks this because there is no membership yet
-- Add a separate policy for the self-insert owner case
CREATE POLICY "Users can insert themselves as owner"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
  );
