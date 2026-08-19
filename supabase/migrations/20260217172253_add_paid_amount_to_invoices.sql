/*
  # Add paid_amount tracking to invoices

  1. Modified Tables
    - `invoices`
      - Add `paid_amount` (numeric, default 0) - tracks cumulative paid amount for partial payments

  2. Important Notes
    - Allows partial payment tracking without marking invoice as fully paid
    - Invoice status should only be 'paid' when paid_amount >= total
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN paid_amount numeric DEFAULT 0;
  END IF;
END $$;
