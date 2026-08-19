/*
  # Create FV Design Versions table

  1. New Tables
    - `fv_design_versions`
      - `id` (uuid, primary key)
      - `fv_design_id` (uuid, FK to fv_designs)
      - `org_id` (uuid, FK to organizations)
      - `version_number` (integer)
      - `note` (text) - user note for this version
      - `summary_battery_kwh` (numeric) - total battery capacity
      - `summary_inverter_kw` (numeric) - inverter power
      - `summary_panel_kwp` (numeric) - total panel power
      - `summary_panel_count` (integer) - total panel count
      - `input_params` (jsonb) - snapshot of input params
      - `roofs` (jsonb) - snapshot of roofs
      - `system_config` (jsonb) - snapshot of system config
      - `pvgis_results` (jsonb) - snapshot of results
      - `created_at` (timestamptz)
      - `created_by` (uuid, FK to auth.users)
  2. Security
    - Enable RLS on `fv_design_versions`
    - Add policies for org members to read/create versions
*/

CREATE TABLE IF NOT EXISTS fv_design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fv_design_id uuid NOT NULL REFERENCES fv_designs(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  note text NOT NULL DEFAULT '',
  summary_battery_kwh numeric(8,2) NOT NULL DEFAULT 0,
  summary_inverter_kw numeric(8,2) NOT NULL DEFAULT 0,
  summary_panel_kwp numeric(8,2) NOT NULL DEFAULT 0,
  summary_panel_count integer NOT NULL DEFAULT 0,
  input_params jsonb NOT NULL DEFAULT '{}',
  roofs jsonb NOT NULL DEFAULT '[]',
  system_config jsonb NOT NULL DEFAULT '{}',
  pvgis_results jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fv_design_versions_design ON fv_design_versions(fv_design_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fv_design_versions_org ON fv_design_versions(org_id);

ALTER TABLE fv_design_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read fv design versions"
  ON fv_design_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_design_versions.org_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create fv design versions"
  ON fv_design_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_design_versions.org_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete fv design versions"
  ON fv_design_versions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = fv_design_versions.org_id
      AND om.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'superadmins') THEN
    EXECUTE 'CREATE POLICY "Superadmins can manage fv design versions"
      ON fv_design_versions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
      )';
  END IF;
END $$;
