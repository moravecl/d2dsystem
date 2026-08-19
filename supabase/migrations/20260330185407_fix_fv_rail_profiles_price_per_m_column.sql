
/*
  # Fix fv_rail_profiles - add price_per_m column

  The table fv_rail_profiles had a column named price_per_piece but the application
  expects price_per_m. This migration adds the missing price_per_m column and
  copies existing data from price_per_piece.

  Changes:
  - fv_rail_profiles: add price_per_m column (numeric, default 0)
  - Copy values from price_per_piece to price_per_m for existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_rail_profiles' AND column_name = 'price_per_m'
  ) THEN
    ALTER TABLE fv_rail_profiles ADD COLUMN price_per_m numeric NOT NULL DEFAULT 0;
    UPDATE fv_rail_profiles SET price_per_m = price_per_piece WHERE price_per_m = 0 AND price_per_piece > 0;
  END IF;
END $$;
