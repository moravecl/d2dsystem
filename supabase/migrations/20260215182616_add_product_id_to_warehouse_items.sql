/*
  # Link warehouse items to catalog products

  1. Modified Tables
    - `warehouse_items`
      - Added `product_id` (uuid, nullable, FK to products) - links warehouse item to catalog product
      - Added unique constraint on product_id to ensure 1:1 mapping

  2. Security
    - No RLS changes needed (existing policies remain)

  3. Notes
    - Warehouse items can now be linked to catalog products
    - This enables stock level display in the catalog
    - Existing warehouse items without product_id remain valid
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_items' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN product_id uuid REFERENCES products(id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_items_product_id ON warehouse_items(product_id) WHERE product_id IS NOT NULL;
  END IF;
END $$;
