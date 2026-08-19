/*
  # Add Employee Profile Details

  1. New Columns on `profiles`
    - `phone` (text) - employee phone number
    - `address` (text) - employee address
    - `birth_date` (date) - date of birth for birthday notifications
    - `job_position` (text) - employee job title/position

  2. New Table `employee_contracts`
    - Stores generated employment contracts for employees
    - Links to document_templates for contract templates

  3. Security
    - RLS policies for employee_contracts table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN birth_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'job_position'
  ) THEN
    ALTER TABLE profiles ADD COLUMN job_position text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employee_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES document_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  signed_at timestamptz,
  signature_employee text,
  signature_employer text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'archived')),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_contracts' AND policyname = 'Org members can view contracts'
  ) THEN
    CREATE POLICY "Org members can view contracts"
      ON employee_contracts FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_contracts' AND policyname = 'Admins can manage contracts'
  ) THEN
    CREATE POLICY "Admins can manage contracts"
      ON employee_contracts FOR ALL TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employee_contracts_employee ON employee_contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_contracts_org ON employee_contracts(organization_id);