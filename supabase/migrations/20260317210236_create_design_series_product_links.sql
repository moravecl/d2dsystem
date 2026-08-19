/*
  # Design Series to Product Links

  1. New Tables
    - `design_series_product_links`
      - `id` (uuid, primary key)
      - `design_series_id` (uuid, references products where kind = 'design_series')
      - `product_id` (uuid, references products)
      - `role_key` (text) - e.g., 'zasuvka', 'zasuvka_5x', 'spinac', 'spinac_2x', 'term_rele', etc.
      - `is_default` (boolean) - whether this is the default product for this role
      - `priority` (integer) - for sorting alternatives
      - `notes` (text, optional)
      - `organization_id` (uuid, references organizations)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `design_series_product_links` table
    - Add policies for organization-scoped access

  3. Indexes
    - Index on design_series_id for fast lookups
    - Index on product_id for fast lookups
    - Unique constraint on design_series_id + product_id + organization_id

  4. Notes
    - role_key maps to the module names used in the design configurator
    - This allows the system to know which concrete product corresponds to
      which module slot in a design series configuration
*/

CREATE TABLE IF NOT EXISTS design_series_product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_series_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  notes text,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(design_series_id, product_id, role_key, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_dspl_design_series ON design_series_product_links(design_series_id);
CREATE INDEX IF NOT EXISTS idx_dspl_product ON design_series_product_links(product_id);
CREATE INDEX IF NOT EXISTS idx_dspl_role_key ON design_series_product_links(role_key);
CREATE INDEX IF NOT EXISTS idx_dspl_org ON design_series_product_links(organization_id);

ALTER TABLE design_series_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view design series links"
  ON design_series_product_links
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert design series links"
  ON design_series_product_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update design series links"
  ON design_series_product_links
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete design series links"
  ON design_series_product_links
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION set_dspl_org_id()
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

DROP TRIGGER IF EXISTS trigger_set_dspl_org_id ON design_series_product_links;
CREATE TRIGGER trigger_set_dspl_org_id
  BEFORE INSERT ON design_series_product_links
  FOR EACH ROW
  EXECUTE FUNCTION set_dspl_org_id();
