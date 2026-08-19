/*
  # Bank Transactions Module

  ## Summary
  Creates a complete bank account transaction tracking system that integrates with the cashflow module.

  ## New Tables

  ### bank_accounts
  - Stores bank account definitions per organization
  - Fields: name, bank_name, account_number, currency, current_balance, is_default, notes

  ### bank_transactions
  - Individual bank account movements (imports from Excel or manual entry)
  - Fields: account_id, date, amount (positive=credit, negative=debit), description, counterparty_name,
    counterparty_account, reference, vs (variable symbol), ks, ss, raw_note, type (credit/debit), status (new/matched/ignored)
  
  ### bank_transaction_matches
  - Links a bank transaction to existing system records
  - Fields: transaction_id, match_type, match_id, matched_amount, note

  ## Security
  - RLS enabled on all tables
  - Organization-scoped access for authenticated users
*/

CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'CZK',
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can select bank_accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_accounts.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert bank_accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_accounts.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update bank_accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_accounts.org_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_accounts.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete bank_accounts"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_accounts.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  counterparty_name text NOT NULL DEFAULT '',
  counterparty_account text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  vs text NOT NULL DEFAULT '',
  ks text NOT NULL DEFAULT '',
  ss text NOT NULL DEFAULT '',
  raw_note text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'credit' CHECK (type IN ('credit','debit')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','matched','ignored')),
  import_batch text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS bank_transactions_org_id_idx ON bank_transactions(org_id);
CREATE INDEX IF NOT EXISTS bank_transactions_account_id_idx ON bank_transactions(account_id);
CREATE INDEX IF NOT EXISTS bank_transactions_date_idx ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS bank_transactions_status_idx ON bank_transactions(status);

CREATE POLICY "Org members can select bank_transactions"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transactions.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert bank_transactions"
  ON bank_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transactions.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update bank_transactions"
  ON bank_transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transactions.org_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transactions.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete bank_transactions"
  ON bank_transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transactions.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS bank_transaction_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  match_type text NOT NULL CHECK (match_type IN ('issued_invoice','received_invoice','manual_cost','manual_income')),
  match_id uuid,
  matched_amount numeric(14,2) NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_transaction_matches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS bank_transaction_matches_transaction_id_idx ON bank_transaction_matches(transaction_id);

CREATE POLICY "Org members can select bank_transaction_matches"
  ON bank_transaction_matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transaction_matches.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert bank_transaction_matches"
  ON bank_transaction_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transaction_matches.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update bank_transaction_matches"
  ON bank_transaction_matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transaction_matches.org_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transaction_matches.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete bank_transaction_matches"
  ON bank_transaction_matches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bank_transaction_matches.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cashflow_settings' AND column_name = 'bank_account_id'
  ) THEN
    ALTER TABLE cashflow_settings ADD COLUMN bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;
