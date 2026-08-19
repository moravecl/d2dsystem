/*
  # Allow multiple warehouse items per product

  1. Modified Indexes
    - Drop UNIQUE index `idx_warehouse_items_product_id` on `warehouse_items`
    - Replace with regular (non-unique) index for query performance

  2. Notes
    - Design series products need multiple warehouse items (frames + modules)
      all referencing the same parent product
    - The unique constraint prevented this; now replaced with a regular index
*/

DROP INDEX IF EXISTS idx_warehouse_items_product_id;
CREATE INDEX IF NOT EXISTS idx_warehouse_items_product_id ON warehouse_items(product_id) WHERE product_id IS NOT NULL;