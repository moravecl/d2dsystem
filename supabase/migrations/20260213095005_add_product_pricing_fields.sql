/*
  # Add Purchase Price and Margin Fields to Products

  1. Changes
    - Add `purchase_price` column to products table (numeric, default 0)
    - Add `margin_percent` column to products table (numeric, default 30)
    
  2. Description
    - `purchase_price`: The cost price of the product (nákupní cena)
    - `margin_percent`: The profit margin percentage used to calculate selling price from purchase price
    - If purchase_price is set, selling price can be calculated as: purchase_price * (1 + margin_percent / 100)
    
  3. Notes
    - Both fields have defaults so existing products won't break
    - Default margin is 30% which is a common industry standard
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE products ADD COLUMN purchase_price numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'margin_percent'
  ) THEN
    ALTER TABLE products ADD COLUMN margin_percent numeric NOT NULL DEFAULT 30;
  END IF;
END $$;