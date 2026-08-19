/*
  # Create Cash Register (Pokladna) Schema

  1. New Tables
    - `cash_transactions`
      - `id` (uuid, primary key)
      - `transaction_type` (text) - 'income' or 'expense'
      - `amount` (numeric) - always positive, type determines direction
      - `description` (text) - description of the transaction
      - `note` (text) - optional note
      - `source` (text) - 'manual', 'invoice_payment', 'received_invoice_payment'
      - `reference_id` (uuid, nullable) - links to invoice/received_invoice payment
      - `performed_by` (uuid) - who physically handled cash (for manual withdrawals)
      - `performed_by_name` (text) - name snapshot for display
      - `transaction_date` (date) - when the transaction happened
      - `created_by` (uuid) - who created the record
      - `organization_id` (uuid) - multi-tenancy isolation
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `cash_transactions` table
    - Policies for authenticated users within same organization
    - Separate policies for SELECT, INSERT, UPDATE, DELETE

  3. Indexes
    - Organization + date for fast balance queries
    - Source + reference_id for linking to invoices

  4. Important Notes
    - Running balance is computed at query time (sum of incomes - sum of expenses)
    - Manual transactions require performed_by and note
    - Automatic transactions from invoice payments store reference_id
*/

CREATE TABLE IF NOT EXISTS cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL DEFAULT 'income' CHECK (transaction_type IN ('income', 'expense')),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  description text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'invoice_payment', 'received_invoice_payment')),
  reference_id uuid,
  performed_by uuid REFERENCES auth.users(id),
  performed_by_name text NOT NULL DEFAULT '',
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_org_date
  ON cash_transactions (organization_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_source_ref
  ON cash_transactions (source, reference_id);

CREATE POLICY "Users can view cash transactions in their org"
  ON cash_transactions FOR SELECT
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Users can create cash transactions in their org"
  ON cash_transactions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Users can update cash transactions in their org"
  ON cash_transactions FOR UPDATE
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Users can delete cash transactions in their org"
  ON cash_transactions FOR DELETE
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1));

CREATE OR REPLACE TRIGGER set_cash_transactions_org_id
  BEFORE INSERT ON cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();
