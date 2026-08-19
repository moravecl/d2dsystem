/*
  # Add product color variants and link images to colors

  1. New Tables
    - `product_colors`
      - `id` (uuid, primary key)
      - `product_id` (uuid, FK to products) - which product this color belongs to
      - `name` (text) - display name e.g. "Bila", "Antracit", "Slonova kost"
      - `hex_code` (text) - hex color for the swatch e.g. "#FFFFFF"
      - `sort_order` (integer) - display ordering
      - `created_at` (timestamptz)

  2. Modified Tables
    - `product_images`
      - Added `color_id` (uuid, nullable FK to product_colors) - optional link to a color variant
      - Images without a color_id are shown for all color selections

  3. Security
    - Enable RLS on `product_colors`
    - Authenticated users can read product colors
    - Admin users can insert/update/delete product colors (using is_admin function)
    - Updated product_images to support color filtering

  4. Important Notes
    - Color variants allow design series products (e.g. ABB Tango) to show different images per color
    - Images with NULL color_id are treated as "universal" and shown regardless of selected color
    - The is_admin() SECURITY DEFINER function is used for admin checks to avoid RLS recursion
*/

CREATE TABLE IF NOT EXISTS product_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  hex_code text NOT NULL DEFAULT '#CCCCCC',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product colors"
  ON product_colors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert product colors"
  ON product_colors
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update product colors"
  ON product_colors
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete product colors"
  ON product_colors
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_images' AND column_name = 'color_id'
  ) THEN
    ALTER TABLE product_images ADD COLUMN color_id uuid REFERENCES product_colors(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON product_colors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_color_id ON product_images(color_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
