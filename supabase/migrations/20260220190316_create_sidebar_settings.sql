/*
  # Create sidebar_settings table

  Stores per-organization sidebar configuration — item order and visibility.
  Admins can customize which sidebar items appear and in what order for their organization.

  1. New Tables
    - `sidebar_settings`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `items` (jsonb) — ordered array of { key, visible } objects
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, FK to auth.users)
  2. Security
    - Enable RLS on `sidebar_settings` table
    - Authenticated org members can read their org's settings
    - Only admins can insert/update their org's settings
*/

CREATE TABLE IF NOT EXISTS sidebar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT sidebar_settings_org_unique UNIQUE (organization_id)
);

ALTER TABLE sidebar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read sidebar settings"
  ON sidebar_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sidebar_settings.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert sidebar settings"
  ON sidebar_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sidebar_settings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can update sidebar settings"
  ON sidebar_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sidebar_settings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sidebar_settings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete sidebar settings"
  ON sidebar_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sidebar_settings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );
