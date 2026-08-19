/*
  # Quick Job Completion Schema - Work Entries and Material Entries

  1. New Tables
    - `quick_job_work_entries`
      - `id` (uuid, primary key)
      - `quick_job_id` (uuid, FK to quick_jobs) - parent quick job
      - `worker_name` (text) - name of the worker
      - `worker_id` (uuid, nullable FK to auth.users) - optional link to system user
      - `hours` (numeric) - hours worked
      - `hourly_rate` (numeric) - rate per hour
      - `description` (text) - what was done
      - `work_date` (date) - date of work
      - `synced_to_attendance` (boolean) - whether synced to attendance_records
      - `synced_to_project` (boolean) - whether synced to parent project worklogs
      - `organization_id` (uuid, FK to organizations)
      - `created_at` (timestamptz)

    - `quick_job_material_entries`
      - `id` (uuid, primary key)
      - `quick_job_id` (uuid, FK to quick_jobs) - parent quick job
      - `material_name` (text) - name of the material
      - `product_id` (uuid, nullable FK to products) - optional link to catalog product
      - `unit` (text) - unit of measurement (ks, m, m2, etc.)
      - `quantity` (numeric) - quantity used
      - `unit_price` (numeric) - selling price per unit
      - `purchase_price` (numeric) - cost price per unit
      - `organization_id` (uuid, FK to organizations)
      - `created_at` (timestamptz)

  2. Modified Tables
    - `quick_jobs`
      - Add `billing_status` (text) - none, ready, invoiced
      - Add `total_work_hours` (numeric) - cached total hours from work entries
      - Add `total_material_cost` (numeric) - cached total material cost
      - Add `total_work_cost` (numeric) - cached total labor cost

  3. Security
    - Enable RLS on both new tables
    - Organization members can read/write their own org's entries

  4. Indexes
    - quick_job_id on both tables
    - organization_id on both tables
*/

-- Add billing and cost columns to quick_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_jobs' AND column_name = 'billing_status'
  ) THEN
    ALTER TABLE quick_jobs ADD COLUMN billing_status text NOT NULL DEFAULT 'none';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_jobs' AND column_name = 'total_work_hours'
  ) THEN
    ALTER TABLE quick_jobs ADD COLUMN total_work_hours numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_jobs' AND column_name = 'total_material_cost'
  ) THEN
    ALTER TABLE quick_jobs ADD COLUMN total_material_cost numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_jobs' AND column_name = 'total_work_cost'
  ) THEN
    ALTER TABLE quick_jobs ADD COLUMN total_work_cost numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Work entries table
CREATE TABLE IF NOT EXISTS quick_job_work_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_job_id uuid NOT NULL REFERENCES quick_jobs(id) ON DELETE CASCADE,
  worker_name text NOT NULL DEFAULT '',
  worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  synced_to_attendance boolean NOT NULL DEFAULT false,
  synced_to_project boolean NOT NULL DEFAULT false,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qj_work_entries_job ON quick_job_work_entries(quick_job_id);
CREATE INDEX IF NOT EXISTS idx_qj_work_entries_org ON quick_job_work_entries(organization_id);

ALTER TABLE quick_job_work_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read qj work entries"
  ON quick_job_work_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert qj work entries"
  ON quick_job_work_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update qj work entries"
  ON quick_job_work_entries FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete qj work entries"
  ON quick_job_work_entries FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Auto-set organization_id trigger for work entries
CREATE OR REPLACE FUNCTION set_qj_work_entry_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_qj_work_entries_set_org ON quick_job_work_entries;
CREATE TRIGGER trg_qj_work_entries_set_org
  BEFORE INSERT ON quick_job_work_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_qj_work_entry_org_id();

-- Material entries table
CREATE TABLE IF NOT EXISTS quick_job_material_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_job_id uuid NOT NULL REFERENCES quick_jobs(id) ON DELETE CASCADE,
  material_name text NOT NULL DEFAULT '',
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  unit text NOT NULL DEFAULT 'ks',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qj_material_entries_job ON quick_job_material_entries(quick_job_id);
CREATE INDEX IF NOT EXISTS idx_qj_material_entries_org ON quick_job_material_entries(organization_id);

ALTER TABLE quick_job_material_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read qj material entries"
  ON quick_job_material_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert qj material entries"
  ON quick_job_material_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update qj material entries"
  ON quick_job_material_entries FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete qj material entries"
  ON quick_job_material_entries FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Auto-set organization_id trigger for material entries
CREATE OR REPLACE FUNCTION set_qj_material_entry_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_qj_material_entries_set_org ON quick_job_material_entries;
CREATE TRIGGER trg_qj_material_entries_set_org
  BEFORE INSERT ON quick_job_material_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_qj_material_entry_org_id();
