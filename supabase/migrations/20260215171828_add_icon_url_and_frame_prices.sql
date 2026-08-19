/*
  # Add icon override to product design modules + frame prices to products

  1. Modified Tables
    - `product_design_modules`
      - `icon_url` (text, nullable) - per-product icon override for a module
    - `products`
      - `frame_prices` (jsonb, nullable) - per-product frame prices, e.g. {"1": 100, "2": 200, "3": 300, "4": 400, "5": 500}

  2. Notes
    - icon_url on product_design_modules allows each design series to have a custom icon per module
    - frame_prices on products allows each design series to define prices for 1-5 module frames
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_design_modules' AND column_name = 'icon_url'
  ) THEN
    ALTER TABLE product_design_modules ADD COLUMN icon_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'frame_prices'
  ) THEN
    ALTER TABLE products ADD COLUMN frame_prices jsonb;
  END IF;
END $$;
