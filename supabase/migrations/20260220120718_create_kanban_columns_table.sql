/*
  # Create kanban_columns table for custom board columns

  1. New Tables
    - `kanban_columns`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `entity_type` (text) - 'leads' or 'service_tickets'
      - `key` (text) - the status value stored on the entity
      - `label` (text) - display name of the column
      - `color` (text) - tailwind color key for the column
      - `position` (integer) - sort order
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `kanban_columns`
    - Authenticated org members can read, insert, update, delete their own org columns

  3. Seed Data
    - Default lead columns: Nový, Kontaktován, Kvalifikován, Převeden, Ztracen
    - Default service ticket columns: Otevřený, Řeší se, Vyřešeno, Uzavřeno

  4. Notes
    - The `key` column is used as the `status` value on leads/service_tickets
    - Position determines left-to-right ordering of columns on the board
*/

CREATE TABLE IF NOT EXISTS kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'leads',
  key text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'slate',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read kanban columns"
  ON kanban_columns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = kanban_columns.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert kanban columns"
  ON kanban_columns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = kanban_columns.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update kanban columns"
  ON kanban_columns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = kanban_columns.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = kanban_columns.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete kanban columns"
  ON kanban_columns FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = kanban_columns.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );
