/*
  # Create element category colors table

  1. New Tables
    - `element_category_colors`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations - nullable for global defaults)
      - `category_slug` (text, the category identifier like 'elektro', 'data', etc.)
      - `color` (text, hex color code)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - Unique constraint on (org_id, category_slug)

  2. Security
    - Enable RLS on `element_category_colors` table
    - Add policies for authenticated users to read their organization's colors
    - Add policies for admins/owners to manage colors

  3. Seed Data
    - Insert default colors for global use (org_id = NULL)
*/

CREATE TABLE IF NOT EXISTS element_category_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  category_slug text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, category_slug)
);

ALTER TABLE element_category_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read global category colors"
  ON element_category_colors
  FOR SELECT
  TO authenticated
  USING (org_id IS NULL);

CREATE POLICY "Users can read own organization category colors"
  ON element_category_colors
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can manage organization category colors"
  ON element_category_colors
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'owner')
    )
  );

INSERT INTO element_category_colors (org_id, category_slug, color) VALUES
  (NULL, 'elektro', '#3b82f6'),
  (NULL, 'data', '#06b6d4'),
  (NULL, 'camera', '#8b5cf6'),
  (NULL, 'eps', '#ef4444'),
  (NULL, 'hvac', '#f97316'),
  (NULL, 'water', '#0ea5e9'),
  (NULL, 'gas', '#eab308'),
  (NULL, 'slaboproud', '#a855f7'),
  (NULL, 'smart', '#10b981'),
  (NULL, 'other', '#6b7280')
ON CONFLICT (org_id, category_slug) DO NOTHING;