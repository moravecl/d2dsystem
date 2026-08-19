/*
  # Konfigurace návrháře

  1. Nové tabulky
    - `designer_config`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, odkaz na organizaci)
      - `enable_products` (boolean) - povolení vkládání produktů (piny na půdorysu)
      - `enable_schematic` (boolean) - povolení schematických značek
      - `default_mode` (text) - výchozí režim při otevření návrháře ('products' nebo 'schematic')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS povoleno
    - Politiky pro čtení a úpravu pouze pro členy organizace
*/

CREATE TABLE IF NOT EXISTS designer_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  enable_products boolean NOT NULL DEFAULT true,
  enable_schematic boolean NOT NULL DEFAULT true,
  default_mode text NOT NULL DEFAULT 'products' CHECK (default_mode IN ('products', 'schematic')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE designer_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org designer config"
  ON designer_config
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can update designer config"
  ON designer_config
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can insert designer config"
  ON designer_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can delete designer config"
  ON designer_config
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION set_designer_config_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_designer_config_org_id_trigger
  BEFORE INSERT ON designer_config
  FOR EACH ROW
  EXECUTE FUNCTION set_designer_config_org_id();
