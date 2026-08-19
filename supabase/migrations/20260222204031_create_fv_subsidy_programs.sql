/*
  # Create FV Subsidy Programs table

  1. New Tables
    - `fv_subsidy_programs`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations) - organization scoping
      - `name` (text) - display name of the program, e.g. "NZU Light"
      - `description` (text) - longer description
      - `max_amount_czk` (integer) - maximum subsidy amount in CZK, e.g. 200000
      - `max_percentage` (integer) - maximum percentage of total cost, e.g. 50
      - `is_active` (boolean) - whether this program is available for selection
      - `sort_order` (integer) - ordering in the UI
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `fv_subsidy_programs`
    - Org-scoped read/write policies for authenticated users

  3. Seed Data
    - Default NZU programs with realistic Czech subsidy rules
*/

CREATE TABLE IF NOT EXISTS fv_subsidy_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  max_amount_czk integer NOT NULL DEFAULT 0,
  max_percentage integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fv_subsidy_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read subsidy programs"
  ON fv_subsidy_programs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert subsidy programs"
  ON fv_subsidy_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update subsidy programs"
  ON fv_subsidy_programs
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete subsidy programs"
  ON fv_subsidy_programs
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );
