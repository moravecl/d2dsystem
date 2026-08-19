/*
  # Add purchase price to material entries

  1. Changes
    - Add `purchase_price` column to `job_material_entries` table
      - Stores the cost/purchase price per unit at time of consumption
      - Used to calculate actual material costs vs expected costs

  2. Description
    - Enables tracking of expected vs actual material costs in the execution module
    - `unit_price` = selling price (from quote)
    - `purchase_price` = cost/purchase price (from product catalog)
    - Expected cost = planned_qty * purchase_price
    - Actual cost = actual_qty * purchase_price
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_material_entries' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE job_material_entries ADD COLUMN purchase_price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
