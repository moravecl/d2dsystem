/*
  # Fix viceprace RLS policies for organization isolation

  ## Problem
  The viceprace table was missing INSERT, UPDATE, and DELETE policies 
  that use organization_id. The old user-based INSERT policy was dropped
  but not replaced with an org-based version, causing insert failures.

  ## Changes
  1. Drop any remaining legacy policies on viceprace
  2. Create new org-based policies for SELECT, INSERT, UPDATE, DELETE
  3. All policies check organization_id = get_my_organization_id()
  4. Superadmin policy uses is_superadmin() function
*/

-- Drop all existing viceprace policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can view viceprace" ON viceprace;
DROP POLICY IF EXISTS "Authenticated users can insert viceprace" ON viceprace;
DROP POLICY IF EXISTS "Authenticated users can update viceprace" ON viceprace;
DROP POLICY IF EXISTS "Authenticated users can delete viceprace" ON viceprace;
DROP POLICY IF EXISTS "Org members can view viceprace" ON viceprace;
DROP POLICY IF EXISTS "Org members can insert viceprace" ON viceprace;
DROP POLICY IF EXISTS "Org members can update viceprace" ON viceprace;
DROP POLICY IF EXISTS "Org members can delete viceprace" ON viceprace;
DROP POLICY IF EXISTS "Superadmins have full access to viceprace" ON viceprace;
DROP POLICY IF EXISTS "Superadmins full access viceprace" ON viceprace;

-- SELECT: Org members can view their organization's viceprace
CREATE POLICY "Org members can view viceprace"
  ON viceprace FOR SELECT
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- INSERT: Org members can create viceprace for their organization
CREATE POLICY "Org members can insert viceprace"
  ON viceprace FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

-- UPDATE: Org members can update their organization's viceprace
CREATE POLICY "Org members can update viceprace"
  ON viceprace FOR UPDATE
  TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

-- DELETE: Org members can delete their organization's viceprace
CREATE POLICY "Org members can delete viceprace"
  ON viceprace FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- Superadmin full access
CREATE POLICY "Superadmins full access viceprace"
  ON viceprace FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());
