/*
  # Add insurance-specific fields to due_items

  1. Modified Tables
    - `due_items`
      - `insurance_company` (text) - name of the insurance provider
      - `insurance_policy_number` (text) - policy/contract number
      - `insurance_price` (numeric) - annual premium cost
      - `insurance_coverages` (jsonb) - array of coverage type strings (e.g. ["liability", "casco", "glass"])

  2. New Tables
    - `insurance_coverage_types`
      - `id` (uuid, primary key)
      - `name` (text) - display name of coverage type
      - `code` (text, unique) - machine-readable code
      - `is_default` (boolean) - whether this is a system-provided default
      - `organization_id` (uuid) - for org isolation, null = global defaults
      - `sort_order` (integer) - display ordering
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `insurance_coverage_types`
    - Add read/write policies for authenticated org members

  4. Seed Data
    - Default coverage types: povinne (liability), havarijni (casco), skla (glass),
      asistence (roadside assistance), odcizeni (theft), zivel (natural disaster),
      stret_se_zveri (animal collision), pravni_ochrana (legal protection)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'due_items' AND column_name = 'insurance_company'
  ) THEN
    ALTER TABLE due_items ADD COLUMN insurance_company text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'due_items' AND column_name = 'insurance_policy_number'
  ) THEN
    ALTER TABLE due_items ADD COLUMN insurance_policy_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'due_items' AND column_name = 'insurance_price'
  ) THEN
    ALTER TABLE due_items ADD COLUMN insurance_price numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'due_items' AND column_name = 'insurance_coverages'
  ) THEN
    ALTER TABLE due_items ADD COLUMN insurance_coverages jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS insurance_coverage_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  organization_id uuid REFERENCES organizations(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_coverage_code_per_org UNIQUE (code, organization_id)
);

ALTER TABLE insurance_coverage_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read coverage types"
  ON insurance_coverage_types FOR SELECT
  TO authenticated
  USING (
    is_default = true
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert custom coverage types"
  ON insurance_coverage_types FOR INSERT
  TO authenticated
  WITH CHECK (
    is_default = false
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update own coverage types"
  ON insurance_coverage_types FOR UPDATE
  TO authenticated
  USING (
    is_default = false
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_default = false
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete own coverage types"
  ON insurance_coverage_types FOR DELETE
  TO authenticated
  USING (
    is_default = false
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

INSERT INTO insurance_coverage_types (name, code, is_default, sort_order) VALUES
  ('Povinné ručení', 'povinne', true, 1),
  ('Havarijní pojištění', 'havarijni', true, 2),
  ('Pojištění skel', 'skla', true, 3),
  ('Asistenční služby', 'asistence', true, 4),
  ('Pojištění proti odcizení', 'odcizeni', true, 5),
  ('Živelní pojištění', 'zivel', true, 6),
  ('Střet se zvěří', 'stret_se_zveri', true, 7),
  ('Právní ochrana', 'pravni_ochrana', true, 8)
ON CONFLICT (code, organization_id) DO NOTHING;
