/*
  # Create viceprace (change orders) table

  1. New Tables
    - `viceprace` (change orders / extras for projects)
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `title` (text, required)
      - `description` (text)
      - `status` (text: draft, pending, approved, rejected, completed)
      - `requested_by` (text - name of person who requested the change)
      - `amount` (numeric - price of the change order)
      - `created_by` (uuid, FK to auth.users)
      - `approved_by` (uuid, FK to auth.users)
      - `approved_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `viceprace` table
    - Policies for authenticated users to manage their change orders
*/

CREATE TABLE IF NOT EXISTS viceprace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  requested_by text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE viceprace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view viceprace"
  ON viceprace FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p WHERE p.id = viceprace.project_id
    )
  );

CREATE POLICY "Authenticated users can insert viceprace"
  ON viceprace FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update viceprace"
  ON viceprace FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p WHERE p.id = viceprace.project_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p WHERE p.id = viceprace.project_id
    )
  );

CREATE POLICY "Authenticated users can delete viceprace"
  ON viceprace FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
