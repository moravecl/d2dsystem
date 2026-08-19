/*
  # Create fixed_costs table

  1. New Tables
    - `fixed_costs`
      - `id` (uuid, primary key)
      - `org_id` (uuid, foreign key to organizations)
      - `name` (text) - name of the fixed cost (e.g., "Nájem kanceláře")
      - `category` (text) - category (e.g., "Nájem", "Mzdy", "Úvěry", "Pojištění", "Služby", "Ostatní")
      - `amount` (numeric) - amount per interval
      - `currency` (text) - currency code, default CZK
      - `interval_type` (text) - recurrence: 'monthly', 'quarterly', 'yearly', 'weekly', 'one_time'
      - `interval_day` (int) - day of month when cost occurs (1-31)
      - `start_date` (date) - when the cost starts
      - `end_date` (date, nullable) - when the cost ends (null = indefinitely)
      - `note` (text, nullable) - additional notes
      - `is_active` (boolean) - whether the cost is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for org members to read/write their org's fixed costs
*/

CREATE TABLE IF NOT EXISTS fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Ostatní',
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  interval_type text NOT NULL DEFAULT 'monthly' CHECK (interval_type IN ('weekly', 'monthly', 'quarterly', 'yearly', 'one_time')),
  interval_day integer CHECK (interval_day IS NULL OR (interval_day >= 1 AND interval_day <= 31)),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fixed costs"
  ON fixed_costs FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins and managers can insert fixed costs"
  ON fixed_costs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Org admins and managers can update fixed costs"
  ON fixed_costs FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Org admins and managers can delete fixed costs"
  ON fixed_costs FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE OR REPLACE FUNCTION set_fixed_costs_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT organization_id INTO NEW.org_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER fixed_costs_set_org_id
  BEFORE INSERT OR UPDATE ON fixed_costs
  FOR EACH ROW EXECUTE FUNCTION set_fixed_costs_org_id();
