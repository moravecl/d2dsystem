/*
  # Resource Groups Schema

  Introduces a flexible team/group entity called `resource_groups`.

  ## New Tables

  ### resource_groups
  - `id` (uuid, pk)
  - `organization_id` (uuid, fk organizations)
  - `name` (text) — display name, e.g. "Tým Martin + Jirka"
  - `color` (text) — hex color for calendar display
  - `type` (text) — 'installation' | 'service' | 'design' | 'other'
  - `created_at`, `updated_at`

  ### resource_group_members
  - `id` (uuid, pk)
  - `group_id` (uuid, fk resource_groups)
  - `profile_id` (uuid, fk profiles)
  - `role` (text) — 'lead' | 'member'
  - `organization_id` (uuid)
  - `created_at`

  ## Modified Tables

  ### projects
  - Adds optional `resource_group_id` column for installation planning assignment

  ## Security
  - RLS enabled on both new tables
  - Org-scoped access: members of org can read, admins/managers can write
*/

CREATE TABLE IF NOT EXISTS resource_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  type text NOT NULL DEFAULT 'installation' CHECK (type IN ('installation', 'service', 'design', 'other')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE resource_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read resource groups"
  ON resource_groups FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can insert resource groups"
  ON resource_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update resource groups"
  ON resource_groups FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete resource groups"
  ON resource_groups FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE TABLE IF NOT EXISTS resource_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES resource_groups(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, profile_id)
);

ALTER TABLE resource_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read resource group members"
  ON resource_group_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can insert resource group members"
  ON resource_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update resource group members"
  ON resource_group_members FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete resource group members"
  ON resource_group_members FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'resource_group_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN resource_group_id uuid REFERENCES resource_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'montaz_end_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN montaz_end_date date;
  END IF;
END $$;
