/*
  # S11: Oznacovani vyuctovanych vicepraci

  Doplnek k S10: pri fakturaci viceprace (v plne vysi, 100 %) se zaznam
  oznaci billed_invoice_id/billed_at a modal Fakturace z projektu ho
  uz nenabizi - stejny princip jako u prace a materialu.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'viceprace' AND column_name = 'billed_invoice_id') THEN
    ALTER TABLE viceprace ADD COLUMN billed_invoice_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'viceprace' AND column_name = 'billed_at') THEN
    ALTER TABLE viceprace ADD COLUMN billed_at timestamptz;
  END IF;
END $$;

-- Kontrola: select column_name from information_schema.columns
--   where table_name = 'viceprace' and column_name like 'billed%';  -> 2 radky
