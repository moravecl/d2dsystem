/*
  # Add default_icon column to products

  1. Modified Tables
    - `products`
      - Added `default_icon` (text, nullable) - stores the default floorplan icon ID for this product

  2. Notes
    - This allows admins to pre-assign a default icon to products
    - When placing a pin, the product's default_icon is used if no user override exists
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'default_icon'
  ) THEN
    ALTER TABLE products ADD COLUMN default_icon text DEFAULT '' NOT NULL;
  END IF;
END $$;
