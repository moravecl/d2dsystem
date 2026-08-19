/*
  # Warranty Claims / Device Replacement Schema

  1. New Tables
    - `warranty_claims`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `device_id` (uuid, FK to installed_devices)
      - `claim_number` (text, unique claim identifier)
      - `claim_type` (text: 'repair' or 'replacement')
      - `original_device_type` (text, snapshot of device type at claim time)
      - `original_device_name` (text, snapshot of device name)
      - `original_serial_number` (text, snapshot of serial number)
      - `original_manufacturer` (text, snapshot of manufacturer)
      - `fault_description` (text, what went wrong)
      - `resolution_description` (text, what was done)
      - `replacement_device_name` (text, new device name if replacement)
      - `replacement_serial_number` (text, new serial number if replacement)
      - `replacement_manufacturer` (text, new manufacturer if replacement)
      - `labor_cost` (numeric, labor cost)
      - `material_cost` (numeric, material cost)
      - `total_cost` (numeric, total cost)
      - `is_warranty` (boolean, covered by warranty or not)
      - `status` (text: draft, completed, signed)
      - `technician_name` (text)
      - `claim_date` (date)
      - `customer_signature` (text, base64 encoded signature data)
      - `customer_name` (text, printed name of signer)
      - `signed_at` (timestamptz, when signature was captured)
      - `notes` (text)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `warranty_claims` table
    - Policies for authenticated org members to manage claims
*/

CREATE TABLE IF NOT EXISTS warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES installed_devices(id) ON DELETE CASCADE,
  claim_number text NOT NULL DEFAULT '',
  claim_type text NOT NULL DEFAULT 'repair',
  original_device_type text NOT NULL DEFAULT '',
  original_device_name text NOT NULL DEFAULT '',
  original_serial_number text NOT NULL DEFAULT '',
  original_manufacturer text NOT NULL DEFAULT '',
  fault_description text NOT NULL DEFAULT '',
  resolution_description text NOT NULL DEFAULT '',
  replacement_device_name text NOT NULL DEFAULT '',
  replacement_serial_number text NOT NULL DEFAULT '',
  replacement_manufacturer text NOT NULL DEFAULT '',
  labor_cost numeric NOT NULL DEFAULT 0,
  material_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  is_warranty boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  technician_name text NOT NULL DEFAULT '',
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_signature text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  signed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view warranty claims"
  ON warranty_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = warranty_claims.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create warranty claims"
  ON warranty_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = warranty_claims.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update warranty claims"
  ON warranty_claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = warranty_claims.project_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = warranty_claims.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete warranty claims"
  ON warranty_claims FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = warranty_claims.project_id
      AND om.user_id = auth.uid()
    )
  );
