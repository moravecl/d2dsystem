/*
  # Create catalog categories table

  1. New Tables
    - `catalog_categories`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations)
      - `catalog_system` (text) - e.g. 'camera', 'eps'
      - `category_group` (text) - e.g. 'camera_type', 'detector_type', 'siren_type'
      - `key` (text) - machine-readable key, e.g. 'dome', 'smoke'
      - `label` (text) - human-readable label, e.g. 'Dome', 'Kourovak'
      - `sort_order` (integer) - display order
      - `is_active` (boolean) - soft delete
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `catalog_categories` table
    - Add policies for org-scoped CRUD for authenticated users

  3. Notes
    - Unique constraint on (org_id, catalog_system, category_group, key)
    - This allows each organization to customize their product categories
*/

CREATE TABLE IF NOT EXISTS catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  catalog_system text NOT NULL DEFAULT '',
  category_group text NOT NULL DEFAULT '',
  key text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_categories_unique_key
  ON catalog_categories (org_id, catalog_system, category_group, key);

ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view catalog categories"
  ON catalog_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = catalog_categories.org_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert catalog categories"
  ON catalog_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = catalog_categories.org_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update catalog categories"
  ON catalog_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = catalog_categories.org_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = catalog_categories.org_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete catalog categories"
  ON catalog_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = catalog_categories.org_id
      AND organization_members.user_id = auth.uid()
    )
  );
