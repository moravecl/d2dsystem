/*
  # Add viceprace line items table

  1. New Tables
    - `viceprace_items` - individual line items within a change order
      - `id` (uuid, primary key)
      - `viceprace_id` (uuid, FK to viceprace)
      - `name` (text, description of the line item)
      - `unit` (text, e.g. ks, m, m2, hod)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `total_price` (numeric, computed)
      - `sort_order` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `viceprace_items`
    - Policies for authenticated users matching parent viceprace access
*/

CREATE TABLE IF NOT EXISTS viceprace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viceprace_id uuid NOT NULL REFERENCES viceprace(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'ks',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE viceprace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view viceprace items"
  ON viceprace_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viceprace v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = viceprace_items.viceprace_id
    )
  );

CREATE POLICY "Authenticated users can insert viceprace items"
  ON viceprace_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viceprace v
      WHERE v.id = viceprace_items.viceprace_id
      AND v.created_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update viceprace items"
  ON viceprace_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viceprace v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = viceprace_items.viceprace_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viceprace v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = viceprace_items.viceprace_id
    )
  );

CREATE POLICY "Authenticated users can delete viceprace items"
  ON viceprace_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viceprace v
      WHERE v.id = viceprace_items.viceprace_id
      AND v.created_by = auth.uid()
    )
  );
