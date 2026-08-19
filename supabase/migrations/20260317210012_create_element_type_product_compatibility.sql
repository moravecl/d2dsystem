/*
  # Element Type to Product Compatibility

  1. New Tables
    - `element_type_product_compatibility`
      - `id` (uuid, primary key)
      - `element_type_id` (uuid, references design_element_types)
      - `product_id` (uuid, references products)
      - `compatibility_type` (text) - 'recommended', 'compatible', 'incompatible'
      - `notes` (text, optional) - additional notes about compatibility
      - `organization_id` (uuid, references organizations)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `element_type_product_compatibility` table
    - Add policies for organization-scoped access

  3. Indexes
    - Index on element_type_id for fast lookups
    - Index on product_id for fast lookups
    - Unique constraint on element_type_id + product_id + organization_id
*/

CREATE TABLE IF NOT EXISTS element_type_product_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_type_id uuid NOT NULL REFERENCES design_element_types(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  compatibility_type text NOT NULL DEFAULT 'compatible' CHECK (compatibility_type IN ('recommended', 'compatible', 'incompatible')),
  notes text,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(element_type_id, product_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_etpc_element_type ON element_type_product_compatibility(element_type_id);
CREATE INDEX IF NOT EXISTS idx_etpc_product ON element_type_product_compatibility(product_id);
CREATE INDEX IF NOT EXISTS idx_etpc_org ON element_type_product_compatibility(organization_id);

ALTER TABLE element_type_product_compatibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view compatibility"
  ON element_type_product_compatibility
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert compatibility"
  ON element_type_product_compatibility
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update compatibility"
  ON element_type_product_compatibility
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

CREATE POLICY "Org admins can delete compatibility"
  ON element_type_product_compatibility
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION set_etpc_org_id()
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

DROP TRIGGER IF EXISTS trigger_set_etpc_org_id ON element_type_product_compatibility;
CREATE TRIGGER trigger_set_etpc_org_id
  BEFORE INSERT ON element_type_product_compatibility
  FOR EACH ROW
  EXECUTE FUNCTION set_etpc_org_id();
