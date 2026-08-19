/*
  # Superadmin full access policies

  Superadmins need to read all data across all organizations for platform management.

  ## Changes
  - Add SELECT policy on organizations for superadmins (see all orgs)
  - Add UPDATE policy on organizations for superadmins (manage any org)
  - Add SELECT policy on organization_members for superadmins (see member counts)
  - Add SELECT policy on projects for superadmins (see project counts)
*/

CREATE POLICY "Superadmins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()));

CREATE POLICY "Superadmins can update any organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()));

CREATE POLICY "Superadmins can view all organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()));

CREATE POLICY "Superadmins can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()));
