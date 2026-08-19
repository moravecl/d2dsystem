/*
  # Add QR Code Support to Warehouse Items

  1. Changes
    - Add `qr_code` column to `warehouse_items` table for storing unique QR code identifiers
    - Set default value to the item's UUID for existing and new items
    - Add unique constraint to ensure no duplicate QR codes

  2. Notes
    - QR codes will be used for fast scanning in warehouse operations
    - Each item gets its ID as the default QR code value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_items' AND column_name = 'qr_code'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN qr_code text;
  END IF;
END $$;

UPDATE warehouse_items SET qr_code = id::text WHERE qr_code IS NULL;

ALTER TABLE warehouse_items ALTER COLUMN qr_code SET DEFAULT gen_random_uuid()::text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_items_qr_code_key'
  ) THEN
    ALTER TABLE warehouse_items ADD CONSTRAINT warehouse_items_qr_code_key UNIQUE (qr_code);
  END IF;
END $$;
