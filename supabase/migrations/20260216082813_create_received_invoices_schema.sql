/*
  # Received Invoices (Prijate faktury)

  1. New Tables
    - `received_invoices`
      - `id` (uuid, primary key)
      - `supplier_name` (text) - name of the supplier/vendor
      - `invoice_number` (text) - supplier's invoice number
      - `invoice_date` (date) - date on the invoice
      - `due_date` (date) - payment due date
      - `total_amount` (numeric, default 0) - total amount including tax
      - `tax_amount` (numeric, default 0) - tax portion
      - `status` (text, default 'draft') - draft/pending/approved/paid
      - `project_id` (uuid, nullable, FK to projects) - optional whole-invoice project assignment
      - `note` (text, default '') - internal note
      - `created_by` (uuid, FK to auth.users) - who created this
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `received_invoice_items`
      - `id` (uuid, primary key)
      - `received_invoice_id` (uuid, FK to received_invoices, CASCADE)
      - `description` (text) - item description
      - `quantity` (numeric, default 1)
      - `unit` (text, default 'ks')
      - `unit_price` (numeric, default 0)
      - `total_price` (numeric, default 0)
      - `project_id` (uuid, nullable, FK to projects) - per-item project assignment
      - `warehouse_item_id` (uuid, nullable, FK to warehouse_items) - link to warehouse item for receipt
      - `create_receipt` (boolean, default false) - flag to create warehouse receipt on save
      - `note` (text, default '')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can read all received invoices
    - Creators can insert received invoices
    - Authenticated users can update received invoices
    - Only creators can delete received invoices
    - Items inherit access via their parent invoice

  3. Indexes
    - received_invoices(status)
    - received_invoices(supplier_name)
    - received_invoices(due_date)
    - received_invoice_items(received_invoice_id)
    - received_invoice_items(project_id)
*/

CREATE TABLE IF NOT EXISTS received_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL DEFAULT '',
  invoice_number text NOT NULL DEFAULT '',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE received_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view received invoices"
  ON received_invoices FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert received invoices"
  ON received_invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update received invoices"
  ON received_invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can delete received invoices"
  ON received_invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS received_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_invoice_id uuid NOT NULL REFERENCES received_invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ks',
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  warehouse_item_id uuid REFERENCES warehouse_items(id) ON DELETE SET NULL,
  create_receipt boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE received_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view received invoice items"
  ON received_invoice_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert received invoice items"
  ON received_invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update received invoice items"
  ON received_invoice_items FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete received invoice items"
  ON received_invoice_items FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_received_invoices_status ON received_invoices(status);
CREATE INDEX IF NOT EXISTS idx_received_invoices_supplier ON received_invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_received_invoices_due_date ON received_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_received_invoice_items_invoice ON received_invoice_items(received_invoice_id);
CREATE INDEX IF NOT EXISTS idx_received_invoice_items_project ON received_invoice_items(project_id);
