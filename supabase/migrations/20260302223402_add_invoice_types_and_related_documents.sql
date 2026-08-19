/*
  # Rozšíření schématu faktur o nové typy dokladů

  ## Popis změn
  Přidáváme plnou podporu pro českou fakturaci:
  - Zálohové faktury (deposit_invoice)
  - Daňové doklady k přijaté platbě (tax_document)
  - Vyúčtovací faktury (settlement_invoice)
  - Dobropisy (credit_note)
  - Pokladní doklady (cash_receipt)

  ## Nové sloupce v tabulce invoices
  - `related_invoice_id` - odkaz na původní fakturu
  - `deposit_percent` - procento zálohy
  - `credit_reason` - důvod dobropisu
  - `is_final` - příznak finálního dokladu
  - `numbering_prefix` - prefix čísla dokladu
  - `cash_register_id` - odkaz na pokladnu

  ## Nové tabulky
  - `invoice_document_links` - vazby mezi doklady

  ## Bezpečnost
  - RLS povoleno, org_id scoping
*/

-- 1. Nové sloupce v tabulce invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'related_invoice_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN related_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'deposit_percent'
  ) THEN
    ALTER TABLE invoices ADD COLUMN deposit_percent numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'credit_reason'
  ) THEN
    ALTER TABLE invoices ADD COLUMN credit_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'is_final'
  ) THEN
    ALTER TABLE invoices ADD COLUMN is_final boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'numbering_prefix'
  ) THEN
    ALTER TABLE invoices ADD COLUMN numbering_prefix text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'cash_register_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cash_register_id uuid;
  END IF;
END $$;

-- Normalizace invoice_type pro existující záznamy
UPDATE invoices
SET invoice_type = 'standard'
WHERE invoice_type IS NULL OR invoice_type = '';

-- 2. Tabulka propojení dokladů
CREATE TABLE IF NOT EXISTS invoice_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  target_invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN (
    'deposit_to_settlement',
    'original_to_credit',
    'deposit_to_tax_doc'
  )),
  deposit_amount_used numeric,
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id),
  UNIQUE(source_invoice_id, target_invoice_id, link_type)
);

ALTER TABLE invoice_document_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inv_links_source ON invoice_document_links(source_invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_links_target ON invoice_document_links(target_invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_links_org ON invoice_document_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_related_id ON invoices(related_invoice_id) WHERE related_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type) WHERE invoice_type IS NOT NULL;

-- RLS policies
CREATE POLICY "Members can view their org invoice links"
  ON invoice_document_links FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert their org invoice links"
  ON invoice_document_links FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update their org invoice links"
  ON invoice_document_links FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can delete their org invoice links"
  ON invoice_document_links FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Superadmin full access to invoice links"
  ON invoice_document_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM superadmins WHERE user_id = auth.uid()
    )
  );

-- Trigger pro auto org_id
CREATE OR REPLACE FUNCTION set_invoice_link_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM invoices
    WHERE id = NEW.source_invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_invoice_link_org_id ON invoice_document_links;
CREATE TRIGGER trg_set_invoice_link_org_id
  BEFORE INSERT ON invoice_document_links
  FOR EACH ROW EXECUTE FUNCTION set_invoice_link_org_id();
