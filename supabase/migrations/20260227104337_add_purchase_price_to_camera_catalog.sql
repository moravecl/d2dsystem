/*
  # Add Purchase Price to Camera Catalog Tables

  1. Changes
    - Add `purchase_price` column to `camera_models` table for tracking cost price
    - Add `purchase_price` column to `camera_nvrs` table for tracking cost price
    - Add `purchase_price` column to `camera_poe_switches` table for tracking cost price
    - Add `purchase_price` column to `camera_accessories` table for tracking cost price
    - Add `purchase_price_per_m` column to `camera_cables` table for tracking cost price per meter

  2. Notes
    - Purchase price is used to calculate actual profit margin in quotes
    - Default value is 0, allowing gradual population of data
    - Selling price remains in existing `price` column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'camera_models' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE camera_models ADD COLUMN purchase_price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'camera_nvrs' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE camera_nvrs ADD COLUMN purchase_price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'camera_poe_switches' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE camera_poe_switches ADD COLUMN purchase_price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'camera_accessories' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE camera_accessories ADD COLUMN purchase_price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'camera_cables' AND column_name = 'purchase_price_per_m'
  ) THEN
    ALTER TABLE camera_cables ADD COLUMN purchase_price_per_m numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
