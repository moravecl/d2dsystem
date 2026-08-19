/*
  # Create FV labor rates table

  1. New Tables
    - `fv_labor_rates`
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - display name e.g. "Montaz panelu"
      - `component_type` (text) - one of: panel, inverter, battery, wallbox, construction, other
      - `price_per_unit` (numeric) - labor price per unit
      - `unit` (text) - e.g. "ks", "kWp", "pausal"
      - `notes` (text, nullable)
      - `is_active` (boolean, default true)
      - `sort_order` (integer, default 0)
      - `created_at` / `updated_at` timestamps

  2. Security
    - Enable RLS
    - Policies for org member access
*/

CREATE TABLE IF NOT EXISTS fv_labor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  component_type text NOT NULL DEFAULT 'other',
  price_per_unit numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'ks',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_labor_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view labor rates"
  ON fv_labor_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert labor rates"
  ON fv_labor_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update labor rates"
  ON fv_labor_rates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete labor rates"
  ON fv_labor_rates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_labor_rates.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );
