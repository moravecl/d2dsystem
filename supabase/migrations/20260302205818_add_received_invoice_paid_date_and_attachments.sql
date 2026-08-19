/*
  # Přijaté faktury: datum úhrady a přílohy

  ## Změny

  1. Tabulka `received_invoices`
     - Přidání sloupce `paid_date` (date) - datum skutečné úhrady faktury
     - Přidání sloupce `paid_amount` (numeric) - skutečně uhrazená částka

  2. Nová tabulka `received_invoice_attachments`
     - Přílohy k přijatým fakturám (originály faktur, PDF, obrázky)
     - `id` - UUID primární klíč
     - `received_invoice_id` - FK na received_invoices
     - `file_name` - název souboru
     - `file_url` - URL v Supabase Storage
     - `file_size` - velikost v bajtech
     - `mime_type` - typ souboru
     - `uploaded_by` - kdo nahrál
     - `created_at` - timestamp

  3. Tabulka `cashflow_settings`
     - Přidání sloupce `bank_balance_correction` (numeric, default 0)
       - Ruční korekce stavu bankovního účtu (rozdíl oproti vypočtené hodnotě)

  4. Bezpečnost
     - RLS povoleno na received_invoice_attachments
     - Politiky pro authenticated uživatele v rámci org
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'received_invoices' AND column_name = 'paid_date'
  ) THEN
    ALTER TABLE received_invoices ADD COLUMN paid_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'received_invoices' AND column_name = 'paid_amount'
  ) THEN
    ALTER TABLE received_invoices ADD COLUMN paid_amount numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cashflow_settings' AND column_name = 'bank_balance_correction'
  ) THEN
    ALTER TABLE cashflow_settings ADD COLUMN bank_balance_correction numeric DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS received_invoice_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_invoice_id uuid NOT NULL REFERENCES received_invoices(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE received_invoice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for their org invoices"
  ON received_invoice_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM received_invoices ri
      JOIN organization_members om ON om.organization_id = ri.organization_id
      WHERE ri.id = received_invoice_attachments.received_invoice_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments for their org invoices"
  ON received_invoice_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM received_invoices ri
      JOIN organization_members om ON om.organization_id = ri.organization_id
      WHERE ri.id = received_invoice_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own attachments"
  ON received_invoice_attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());
