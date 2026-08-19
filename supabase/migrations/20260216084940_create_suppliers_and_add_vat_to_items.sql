/*
  # Suppliers table + VAT on invoice items

  1. New Tables
    - `suppliers`
      - `id` (uuid, primary key)
      - `name` (text) - supplier/vendor name
      - `ico` (text) - company ID number
      - `dic` (text) - VAT number
      - `address` (text) - full address
      - `email` (text) - contact email
      - `phone` (text) - contact phone
      - `contact_person` (text) - contact person name
      - `default_due_days` (integer, default 14) - standard payment terms in days
      - `note` (text) - internal note
      - `is_active` (boolean, default true)
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `received_invoices`
      - Add `supplier_id` (uuid, FK to suppliers) - link to supplier record
    - `received_invoice_items`
      - Add `vat_rate` (numeric, default 21) - VAT rate percentage (0, 12, 21)

  3. Security
    - Enable RLS on `suppliers`
    - Authenticated users can read/insert/update suppliers
    - Only creators can delete suppliers

  4. Indexes
    - suppliers(name)
    - suppliers(is_active)
*/

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  ico text NOT NULL DEFAULT '',
  dic text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  default_due_days integer NOT NULL DEFAULT 14,
  note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'received_invoices' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE received_invoices ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'received_invoice_items' AND column_name = 'vat_rate'
  ) THEN
    ALTER TABLE received_invoice_items ADD COLUMN vat_rate numeric NOT NULL DEFAULT 21;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_received_invoices_supplier_id ON received_invoices(supplier_id);
