/*
  # Add insurance payment frequency to due_items

  1. Modified Tables
    - `due_items`
      - `insurance_payment_frequency` (text, nullable) - How often insurance is paid: 'quarterly', 'semi_annual', 'annual'

  2. Notes
    - Default is NULL (unset), user picks from dropdown
    - Values: quarterly (ctvrtletne), semi_annual (polrocne), annual (rocne)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'due_items' AND column_name = 'insurance_payment_frequency'
  ) THEN
    ALTER TABLE due_items ADD COLUMN insurance_payment_frequency text DEFAULT NULL;
  END IF;
END $$;
