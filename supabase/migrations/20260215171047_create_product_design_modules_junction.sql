/*
  # Product-specific design modules

  1. New Tables
    - `product_design_modules` (junction table)
      - `id` (uuid, PK)
      - `product_id` (uuid, FK -> products)
      - `design_module_id` (uuid, FK -> design_modules)
      - `price` (numeric, product-specific price for this module)
      - `sort_order` (integer, display ordering)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can read
    - Admin-only write via service role

  3. Notes
    - Each design_series product can have its own subset of modules
    - Each product can set its own price per module
    - Unique constraint on (product_id, design_module_id)
*/

CREATE TABLE IF NOT EXISTS product_design_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  design_module_id uuid NOT NULL REFERENCES design_modules(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, design_module_id)
);

ALTER TABLE product_design_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read product design modules"
  ON product_design_modules
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert product design modules"
  ON product_design_modules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product design modules"
  ON product_design_modules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete product design modules"
  ON product_design_modules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
