/*
  # Přidání prefixů číslování pro různé typy dokladů

  ## Popis
  Přidává do tabulky invoice_settings možnost nastavit samostatný prefix a čítač
  pro každý typ dokladu (faktura, zálohová faktura, daňový doklad, dobropis,
  vyúčtovací faktura, pokladní doklad).

  ## Nové sloupce v invoice_settings
  - `prefix_standard` - prefix pro běžné faktury (výchozí: FV)
  - `prefix_deposit_invoice` - prefix pro zálohové faktury (výchozí: ZF)
  - `prefix_tax_document` - prefix pro daňové doklady (výchozí: DD)
  - `prefix_credit_note` - prefix pro dobropisy (výchozí: D)
  - `prefix_settlement_invoice` - prefix pro vyúčtovací faktury (výchozí: VF)
  - `prefix_cash_receipt` - prefix pro pokladní doklady (výchozí: PPD)
  - `next_number_deposit_invoice` - čítač zálohových faktur
  - `next_number_tax_document` - čítač daňových dokladů
  - `next_number_credit_note` - čítač dobropisů
  - `next_number_settlement_invoice` - čítač vyúčtovacích faktur
  - `next_number_cash_receipt` - čítač pokladních dokladů

  ## Poznámky
  - Původní next_number slouží pro standardní faktury
  - Každý typ má vlastní nezávislý čítač
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'prefix_standard') THEN
    ALTER TABLE invoice_settings ADD COLUMN prefix_standard text DEFAULT 'FV';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'prefix_deposit_invoice') THEN
    ALTER TABLE invoice_settings ADD COLUMN prefix_deposit_invoice text DEFAULT 'ZF';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'prefix_tax_document') THEN
    ALTER TABLE invoice_settings ADD COLUMN prefix_tax_document text DEFAULT 'DD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'prefix_credit_note') THEN
    ALTER TABLE invoice_settings ADD COLUMN prefix_credit_note text DEFAULT 'D';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'prefix_settlement_invoice') THEN
    ALTER TABLE invoice_settings ADD COLUMN prefix_settlement_invoice text DEFAULT 'VF';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'prefix_cash_receipt') THEN
    ALTER TABLE invoice_settings ADD COLUMN prefix_cash_receipt text DEFAULT 'PPD';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'next_number_deposit_invoice') THEN
    ALTER TABLE invoice_settings ADD COLUMN next_number_deposit_invoice integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'next_number_tax_document') THEN
    ALTER TABLE invoice_settings ADD COLUMN next_number_tax_document integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'next_number_credit_note') THEN
    ALTER TABLE invoice_settings ADD COLUMN next_number_credit_note integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'next_number_settlement_invoice') THEN
    ALTER TABLE invoice_settings ADD COLUMN next_number_settlement_invoice integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'next_number_cash_receipt') THEN
    ALTER TABLE invoice_settings ADD COLUMN next_number_cash_receipt integer DEFAULT 1;
  END IF;
END $$;

-- Aktualizovat existující záznamy aby používaly prefix_standard z number_prefix
UPDATE invoice_settings SET prefix_standard = number_prefix WHERE prefix_standard IS NULL OR prefix_standard = 'FV';
