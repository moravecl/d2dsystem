/*
  # Create Quick Jobs Module

  1. New Tables
    - `quick_jobs`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `title` (text, required) - short description of the job
      - `description` (text) - detailed description
      - `client_id` (uuid, nullable FK to clients) - link to existing CRM client
      - `client_name` (text) - manual client name for one-off customers
      - `project_id` (uuid, nullable FK to projects) - link to parent project
      - `address` (text) - job location address
      - `address_lat` (float) - GPS latitude
      - `address_lon` (float) - GPS longitude
      - `priority` (text) - low, normal, high, urgent
      - `estimated_hours` (numeric) - estimated work hours
      - `status` (text) - pool, claimed, scheduled, in_progress, done, cancelled
      - `claimed_by` (uuid, nullable FK to auth.users) - who claimed the job
      - `claimed_at` (timestamptz) - when it was claimed
      - `scheduled_date` (date) - planned execution date
      - `scheduled_note` (text) - notes about the schedule
      - `completed_at` (timestamptz) - when the job was completed
      - `completion_notes` (text) - technician notes after completion
      - `tags` (text[]) - categorization tags
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `quick_jobs` table
    - Organization members can read/write their own org's quick jobs

  3. Indexes
    - status, organization_id, claimed_by, scheduled_date, project_id, client_id
*/

CREATE TABLE IF NOT EXISTS quick_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  title text NOT NULL,
  description text DEFAULT '',
  client_id uuid REFERENCES clients(id),
  client_name text DEFAULT '',
  project_id uuid REFERENCES projects(id),
  address text DEFAULT '',
  address_lat float,
  address_lon float,
  priority text NOT NULL DEFAULT 'normal',
  estimated_hours numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pool',
  claimed_by uuid REFERENCES auth.users(id),
  claimed_at timestamptz,
  scheduled_date date,
  scheduled_note text DEFAULT '',
  completed_at timestamptz,
  completion_notes text DEFAULT '',
  tags text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_jobs_status ON quick_jobs(status);
CREATE INDEX IF NOT EXISTS idx_quick_jobs_org ON quick_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_quick_jobs_claimed_by ON quick_jobs(claimed_by);
CREATE INDEX IF NOT EXISTS idx_quick_jobs_scheduled_date ON quick_jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_quick_jobs_project_id ON quick_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_quick_jobs_client_id ON quick_jobs(client_id);

ALTER TABLE quick_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read quick jobs"
  ON quick_jobs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert quick jobs"
  ON quick_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update quick jobs"
  ON quick_jobs FOR UPDATE
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

CREATE POLICY "Org members can delete quick jobs"
  ON quick_jobs FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_quick_job_org_id()
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

DROP TRIGGER IF EXISTS trg_quick_jobs_set_org ON quick_jobs;
CREATE TRIGGER trg_quick_jobs_set_org
  BEFORE INSERT ON quick_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_quick_job_org_id();
