/*
  # Add viceprace (extra work) support

  1. New Tables
    - `execution_viceprace` - Tracks additional products/work not in original quote
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `product_id` (uuid, optional FK to products)
      - `name` (text) - description of extra work
      - `unit` (text) - unit of measure
      - `quantity` (numeric) - amount
      - `unit_price` (numeric) - price per unit
      - `reason` (text) - why this was added
      - `approved` (boolean) - whether client approved
      - `approved_at` (timestamptz)
      - `created_by` (uuid)

  2. Security
    - RLS enabled
    - Project owners can CRUD their own viceprace entries
*/

CREATE TABLE IF NOT EXISTS execution_viceprace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  unit text DEFAULT 'ks',
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  reason text DEFAULT '',
  approved boolean DEFAULT false,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE execution_viceprace ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_viceprace' AND policyname = 'Project owners can view viceprace') THEN
    CREATE POLICY "Project owners can view viceprace" ON execution_viceprace FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_viceprace.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_viceprace' AND policyname = 'Project owners can insert viceprace') THEN
    CREATE POLICY "Project owners can insert viceprace" ON execution_viceprace FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_viceprace.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_viceprace' AND policyname = 'Project owners can update viceprace') THEN
    CREATE POLICY "Project owners can update viceprace" ON execution_viceprace FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_viceprace.project_id AND projects.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_viceprace.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_viceprace' AND policyname = 'Project owners can delete viceprace') THEN
    CREATE POLICY "Project owners can delete viceprace" ON execution_viceprace FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_viceprace.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;
