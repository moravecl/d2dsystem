/*
  # Create Company Documents Schema

  1. New Tables
    - `company_folders`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `parent_id` (uuid, self-referencing FK for nested folders)
      - `name` (text, folder name)
      - `color` (text, optional folder color)
      - `icon` (text, optional folder icon name)
      - `sort_order` (integer, for custom ordering)
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `company_files`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `folder_id` (uuid, FK to company_folders, nullable for root)
      - `name` (text, display name)
      - `description` (text, optional)
      - `file_url` (text, storage URL)
      - `file_type` (text, mime/extension)
      - `file_size` (bigint, bytes)
      - `tags` (text[], searchable tags)
      - `is_pinned` (boolean, for favorites)
      - `uploaded_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies scoped to organization membership
    - Read access for all org members
    - Write access for all org members (admins manage via UI)

  3. Indexes
    - parent_id on company_folders for tree queries
    - folder_id on company_files for listing
    - organization_id on both tables
    - GIN index on tags for search
*/

-- company_folders table
CREATE TABLE IF NOT EXISTS company_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES company_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '',
  icon text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_folders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_company_folders_org ON company_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_folders_parent ON company_folders(parent_id);

-- company_files table
CREATE TABLE IF NOT EXISTS company_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES company_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  file_url text NOT NULL,
  file_type text DEFAULT '',
  file_size bigint DEFAULT 0,
  tags text[] DEFAULT '{}',
  is_pinned boolean DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_company_files_org ON company_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_files_folder ON company_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_company_files_tags ON company_files USING GIN(tags);

-- RLS Policies for company_folders
CREATE POLICY "Org members can read company folders"
  ON company_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_folders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create company folders"
  ON company_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_folders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update company folders"
  ON company_folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_folders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_folders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete company folders"
  ON company_folders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_folders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policies for company_files
CREATE POLICY "Org members can read company files"
  ON company_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_files.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create company files"
  ON company_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_files.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update company files"
  ON company_files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_files.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_files.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete company files"
  ON company_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = company_files.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Auto-set organization_id triggers (reuse existing pattern)
CREATE OR REPLACE FUNCTION set_company_folder_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT om.organization_id INTO NEW.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_company_file_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT om.organization_id INTO NEW.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_company_folder_org_id ON company_folders;
CREATE TRIGGER trg_set_company_folder_org_id
  BEFORE INSERT ON company_folders
  FOR EACH ROW
  EXECUTE FUNCTION set_company_folder_org_id();

DROP TRIGGER IF EXISTS trg_set_company_file_org_id ON company_files;
CREATE TRIGGER trg_set_company_file_org_id
  BEFORE INSERT ON company_files
  FOR EACH ROW
  EXECUTE FUNCTION set_company_file_org_id();