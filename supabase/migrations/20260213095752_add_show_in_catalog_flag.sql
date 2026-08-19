/*
  # Add show_in_catalog flag to products

  1. Changes
    - Add `show_in_catalog` boolean column to products table (default true)
    
  2. Description
    - Controls whether a product is displayed in the public catalog browser
    - Products with show_in_catalog = false can still be manually added to quotes
    - Existing products default to visible (true) to preserve current behavior
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'show_in_catalog'
  ) THEN
    ALTER TABLE products ADD COLUMN show_in_catalog boolean NOT NULL DEFAULT true;
  END IF;
END $$;