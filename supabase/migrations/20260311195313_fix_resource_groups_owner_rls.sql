/*
  # Fix resource_groups RLS — include owner role

  The INSERT/UPDATE/DELETE policies only checked for 'admin' and 'manager' roles,
  excluding 'owner'. Since owners must be able to manage resource groups, we update
  all write policies to also allow 'owner'.

  Also applies the same fix to resource_group_members for consistency.
*/

DROP POLICY IF EXISTS "Admins and managers can insert resource groups" ON resource_groups;
DROP POLICY IF EXISTS "Admins and managers can update resource groups" ON resource_groups;
DROP POLICY IF EXISTS "Admins and managers can delete resource groups" ON resource_groups;

CREATE POLICY "Owners, admins and managers can insert resource groups"
  ON resource_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Owners, admins and managers can update resource groups"
  ON resource_groups FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Owners, admins and managers can delete resource groups"
  ON resource_groups FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and managers can insert resource group members" ON resource_group_members;
DROP POLICY IF EXISTS "Admins and managers can update resource group members" ON resource_group_members;
DROP POLICY IF EXISTS "Admins and managers can delete resource group members" ON resource_group_members;

CREATE POLICY "Owners, admins and managers can insert resource group members"
  ON resource_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Owners, admins and managers can update resource group members"
  ON resource_group_members FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Owners, admins and managers can delete resource group members"
  ON resource_group_members FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );
