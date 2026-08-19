/*
  # Create Automations Schema

  1. New Tables
    - `automations`
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - user-given automation name
      - `description` (text) - optional description
      - `is_active` (boolean) - whether the automation is enabled
      - `trigger_entity` (text) - entity type that triggers: project, task, invoice, client, service_ticket
      - `trigger_event` (text) - event type: status_changed, created, updated, due_date_approaching, overdue
      - `trigger_conditions` (jsonb) - conditions e.g. {"from_status": "draft", "to_status": "execution"}
      - `actions` (jsonb) - array of actions to perform
      - `sort_order` (integer) - display ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, FK to auth.users)

    - `automation_logs`
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `automation_id` (uuid, FK to automations)
      - `trigger_entity` (text) - what entity triggered it
      - `trigger_entity_id` (uuid) - the ID of the entity
      - `status` (text) - success, error
      - `details` (jsonb) - execution details
      - `executed_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for org members to manage their automations
    - Policies for org members to view their automation logs
*/

CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  trigger_entity text NOT NULL DEFAULT 'project',
  trigger_event text NOT NULL DEFAULT 'status_changed',
  trigger_conditions jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '[]',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view automations"
  ON automations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = automations.org_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert automations"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = automations.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update automations"
  ON automations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = automations.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = automations.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete automations"
  ON automations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = automations.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  automation_id uuid NOT NULL REFERENCES automations(id),
  trigger_entity text NOT NULL DEFAULT '',
  trigger_entity_id uuid,
  status text NOT NULL DEFAULT 'success',
  details jsonb NOT NULL DEFAULT '{}',
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view automation logs"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = automation_logs.org_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert automation logs"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = automation_logs.org_id
      AND om.user_id = auth.uid()
    )
  );
