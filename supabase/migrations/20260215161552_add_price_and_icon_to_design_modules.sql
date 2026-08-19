/*
  # Add price and icon to design modules

  1. Modified Tables
    - `design_modules`
      - `price` (numeric, default 0) - individual price for this module/insert
      - `icon_url` (text, nullable) - optional icon or image URL for this module

  2. Important Notes
    - Existing modules will default to price 0
    - icon_url is optional, modules without it will display as before
    - This enables independent pricing and visual identification of each module in a design series
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_modules' AND column_name = 'price'
  ) THEN
    ALTER TABLE design_modules ADD COLUMN price numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_modules' AND column_name = 'icon_url'
  ) THEN
    ALTER TABLE design_modules ADD COLUMN icon_url text;
  END IF;
END $$;
