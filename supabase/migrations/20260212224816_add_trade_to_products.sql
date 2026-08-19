/*
  # Add trade column to products

  1. Modified Tables
    - `products`
      - Added `trade` (text, default 'electric') - the trade/discipline this product belongs to
        - 'electric' = Elektro, audio, slaboproud
        - 'water' = Voda
        - 'heating' = Topení
        - 'recuperation' = Rekuperace / VZT

  2. Notes
    - This allows products to be hidden/shown when a trade layer is toggled in the floorplan
    - Defaults to 'electric' since most products are electrical
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'trade'
  ) THEN
    ALTER TABLE products ADD COLUMN trade text DEFAULT 'electric' NOT NULL;
  END IF;
END $$;
