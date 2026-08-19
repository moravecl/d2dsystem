
/*
  # Fix FV Catalog RLS - Add owner role

  ## Problem
  All FV catalog tables (panels, inverters, batteries, wallboxes, accessories,
  hooks, rail_profiles, clamps, roof_tiles) have INSERT/UPDATE/DELETE policies
  that only allow 'admin' and 'manager' roles, but the 'owner' role (assigned
  to the organization creator) is missing. This prevents owners from saving
  new items to the FV catalog.

  ## Changes
  - Updates all INSERT, UPDATE, DELETE policies on all FV catalog tables to
    include 'owner' role alongside 'admin' and 'manager'.

  ## Affected tables
  - fv_panels
  - fv_inverters
  - fv_batteries
  - fv_wallboxes
  - fv_accessories
  - fv_roof_tiles
  - fv_hooks
  - fv_rail_profiles
  - fv_clamps
*/

-- fv_panels
DROP POLICY IF EXISTS "Org admins can insert fv_panels" ON fv_panels;
DROP POLICY IF EXISTS "Org admins can update fv_panels" ON fv_panels;
DROP POLICY IF EXISTS "Org admins can delete fv_panels" ON fv_panels;

CREATE POLICY "Org admins can insert fv_panels"
  ON fv_panels FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can update fv_panels"
  ON fv_panels FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can delete fv_panels"
  ON fv_panels FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_inverters
DROP POLICY IF EXISTS "Org admins can insert fv_inverters" ON fv_inverters;
DROP POLICY IF EXISTS "Org admins can update fv_inverters" ON fv_inverters;
DROP POLICY IF EXISTS "Org admins can delete fv_inverters" ON fv_inverters;

CREATE POLICY "Org admins can insert fv_inverters"
  ON fv_inverters FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can update fv_inverters"
  ON fv_inverters FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can delete fv_inverters"
  ON fv_inverters FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_batteries
DROP POLICY IF EXISTS "Org admins can insert fv_batteries" ON fv_batteries;
DROP POLICY IF EXISTS "Org admins can update fv_batteries" ON fv_batteries;
DROP POLICY IF EXISTS "Org admins can delete fv_batteries" ON fv_batteries;

CREATE POLICY "Org admins can insert fv_batteries"
  ON fv_batteries FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can update fv_batteries"
  ON fv_batteries FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can delete fv_batteries"
  ON fv_batteries FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_wallboxes
DROP POLICY IF EXISTS "Org admins can insert fv_wallboxes" ON fv_wallboxes;
DROP POLICY IF EXISTS "Org admins can update fv_wallboxes" ON fv_wallboxes;
DROP POLICY IF EXISTS "Org admins can delete fv_wallboxes" ON fv_wallboxes;

CREATE POLICY "Org admins can insert fv_wallboxes"
  ON fv_wallboxes FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can update fv_wallboxes"
  ON fv_wallboxes FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can delete fv_wallboxes"
  ON fv_wallboxes FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_accessories
DROP POLICY IF EXISTS "Org admins can insert fv_accessories" ON fv_accessories;
DROP POLICY IF EXISTS "Org admins can update fv_accessories" ON fv_accessories;
DROP POLICY IF EXISTS "Org admins can delete fv_accessories" ON fv_accessories;

CREATE POLICY "Org admins can insert fv_accessories"
  ON fv_accessories FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can update fv_accessories"
  ON fv_accessories FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can delete fv_accessories"
  ON fv_accessories FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_roof_tiles
DROP POLICY IF EXISTS "Admins can insert roof tiles" ON fv_roof_tiles;
DROP POLICY IF EXISTS "Admins can update roof tiles" ON fv_roof_tiles;
DROP POLICY IF EXISTS "Admins can delete roof tiles" ON fv_roof_tiles;

CREATE POLICY "Admins can insert roof tiles"
  ON fv_roof_tiles FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can update roof tiles"
  ON fv_roof_tiles FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can delete roof tiles"
  ON fv_roof_tiles FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_hooks
DROP POLICY IF EXISTS "Admins can insert hooks" ON fv_hooks;
DROP POLICY IF EXISTS "Admins can update hooks" ON fv_hooks;
DROP POLICY IF EXISTS "Admins can delete hooks" ON fv_hooks;

CREATE POLICY "Admins can insert hooks"
  ON fv_hooks FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can update hooks"
  ON fv_hooks FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can delete hooks"
  ON fv_hooks FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_rail_profiles
DROP POLICY IF EXISTS "Admins can insert rail profiles" ON fv_rail_profiles;
DROP POLICY IF EXISTS "Admins can update rail profiles" ON fv_rail_profiles;
DROP POLICY IF EXISTS "Admins can delete rail profiles" ON fv_rail_profiles;

CREATE POLICY "Admins can insert rail profiles"
  ON fv_rail_profiles FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can update rail profiles"
  ON fv_rail_profiles FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can delete rail profiles"
  ON fv_rail_profiles FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_clamps
DROP POLICY IF EXISTS "Admins can insert clamps" ON fv_clamps;
DROP POLICY IF EXISTS "Admins can update clamps" ON fv_clamps;
DROP POLICY IF EXISTS "Admins can delete clamps" ON fv_clamps;

CREATE POLICY "Admins can insert clamps"
  ON fv_clamps FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can update clamps"
  ON fv_clamps FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Admins can delete clamps"
  ON fv_clamps FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

-- fv_labor_rates (already has owner, but update to be consistent)
DROP POLICY IF EXISTS "Org admins can insert labor rates" ON fv_labor_rates;
DROP POLICY IF EXISTS "Org admins can update labor rates" ON fv_labor_rates;
DROP POLICY IF EXISTS "Org admins can delete labor rates" ON fv_labor_rates;

CREATE POLICY "Org admins can insert labor rates"
  ON fv_labor_rates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can update labor rates"
  ON fv_labor_rates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role = ANY(ARRAY['owner','admin','manager'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));

CREATE POLICY "Org admins can delete labor rates"
  ON fv_labor_rates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role = ANY(ARRAY['owner','admin','manager'])
  ));
