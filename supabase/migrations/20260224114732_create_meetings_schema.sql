/*
  # Create meetings & meeting notes schema

  1. New Tables
    - `meetings` - Core meeting/porada table
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `title` (text) - Meeting title
      - `type` (text) - 'porada' (internal) or 'schuzka' (with client)
      - `description` (text)
      - `location` (text)
      - `start_date` (date), `start_time` (time)
      - `end_date` (date), `end_time` (time)
      - `status` (text) - planned / in_progress / completed / cancelled
      - `project_id` (uuid, optional FK to projects)
      - `client_id` (uuid, optional FK to clients)
      - `created_by` (uuid, FK to auth.users)

    - `meeting_attendees` - People attending the meeting
    - `meeting_agenda_items` - Agenda topics for the meeting
    - `meeting_minutes` - Meeting notes/minutes (one per meeting)
    - `meeting_action_items` - Tasks created from the meeting

  2. Security
    - RLS enabled on all tables
    - Policies scoped to authenticated users within their organization
    - Organization auto-populate trigger on meetings table

  3. Indexes
    - Performance indexes on foreign keys and commonly queried columns
*/

-- meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  title text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'porada',
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time DEFAULT '09:00',
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  end_time time DEFAULT '10:00',
  status text NOT NULL DEFAULT 'planned',
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view meetings"
  ON meetings FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org members can insert meetings"
  ON meetings FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update meetings"
  ON meetings FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete meetings"
  ON meetings FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- Auto-set organization_id trigger
DROP TRIGGER IF EXISTS set_org_id ON meetings;
CREATE TRIGGER set_org_id
  BEFORE INSERT ON meetings
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- meeting_attendees table
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'attendee',
  attendance_status text NOT NULL DEFAULT 'invited',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view meeting attendees"
  ON meeting_attendees FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_attendees.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can insert meeting attendees"
  ON meeting_attendees FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_attendees.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can update meeting attendees"
  ON meeting_attendees FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_attendees.meeting_id
    AND m.organization_id = get_my_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_attendees.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can delete meeting attendees"
  ON meeting_attendees FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_attendees.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

-- meeting_agenda_items table
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 10,
  responsible_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view meeting agenda items"
  ON meeting_agenda_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_agenda_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can insert meeting agenda items"
  ON meeting_agenda_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_agenda_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can update meeting agenda items"
  ON meeting_agenda_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_agenda_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_agenda_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can delete meeting agenda items"
  ON meeting_agenda_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_agenda_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

-- meeting_minutes table (one per meeting)
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  decisions text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  duration_minutes integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view meeting minutes"
  ON meeting_minutes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_minutes.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can insert meeting minutes"
  ON meeting_minutes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_minutes.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can update meeting minutes"
  ON meeting_minutes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_minutes.meeting_id
    AND m.organization_id = get_my_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_minutes.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can delete meeting minutes"
  ON meeting_minutes FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_minutes.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

-- meeting_action_items table
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  assigned_to uuid REFERENCES auth.users(id),
  due_date date,
  status text NOT NULL DEFAULT 'open',
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view meeting action items"
  ON meeting_action_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_action_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can insert meeting action items"
  ON meeting_action_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_action_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can update meeting action items"
  ON meeting_action_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_action_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_action_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

CREATE POLICY "Org members can delete meeting action items"
  ON meeting_action_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM meetings m WHERE m.id = meeting_action_items.meeting_id
    AND m.organization_id = get_my_organization_id()
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_org_id ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_date ON meetings(start_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting_id ON meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_meeting_id ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting_id ON meeting_minutes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_task_id ON meeting_action_items(task_id);
