/*
  # Link camera and EPS/EZS catalog items to warehouse

  1. Modified Tables
    - `warehouse_items`
      - `camera_product_id` (uuid, nullable) - links to any camera catalog table item
      - `eps_product_id` (uuid, nullable) - links to any EPS/EZS catalog table item
      - `camera_table` (text, nullable) - which camera table the item comes from (camera_models, camera_nvrs, etc.)
      - `eps_table` (text, nullable) - which EPS table the item comes from (eps_detector_models, eps_panels, etc.)
      - `catalog_source` (text, default '') - 'products', 'camera', 'eps' or '' for manual items

  2. Notes
    - No foreign keys since camera/eps items span multiple tables
    - Index on camera_product_id and eps_product_id for quick lookup
    - catalog_source helps distinguish item origin in the UI
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_items' AND column_name = 'camera_product_id'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN camera_product_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_items' AND column_name = 'eps_product_id'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN eps_product_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_items' AND column_name = 'camera_table'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN camera_table text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_items' AND column_name = 'eps_table'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN eps_table text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_items' AND column_name = 'catalog_source'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN catalog_source text NOT NULL DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_warehouse_items_camera_product_id
  ON warehouse_items(camera_product_id) WHERE camera_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_items_eps_product_id
  ON warehouse_items(eps_product_id) WHERE eps_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_items_catalog_source
  ON warehouse_items(catalog_source) WHERE catalog_source != '';

UPDATE warehouse_items
SET catalog_source = 'products'
WHERE product_id IS NOT NULL AND catalog_source = '';
