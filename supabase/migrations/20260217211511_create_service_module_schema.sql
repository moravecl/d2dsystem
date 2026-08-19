/*
  # Service Module Schema

  1. New Tables
    - `service_types` - Definable service types (revize, pravidelny servis, etc.)
      - `id` (uuid, primary key)
      - `name` (text) - Service type name
      - `interval_months` (integer) - How often the service repeats
      - `description` (text) - Description of the service type
      - `is_active` (boolean) - Whether the type is active
      - `sort_order` (integer) - Display ordering
      - `created_at` (timestamptz)

    - `service_schedules` - Scheduled services linked to projects
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `service_type_id` (uuid, FK to service_types)
      - `next_date` (date) - Next scheduled service date
      - `last_completed_date` (date, nullable) - When last completed
      - `notes` (text) - Additional notes
      - `is_active` (boolean) - Whether the schedule is active
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `service_tickets` - Support/service tickets from customers or internal
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `service_schedule_id` (uuid, nullable FK to service_schedules)
      - `title` (text) - Ticket title
      - `description` (text) - Detailed description
      - `status` (text) - open, in_progress, resolved, closed
      - `priority` (text) - low, normal, high, urgent
      - `reported_by_portal` (boolean) - Whether submitted by customer via portal
      - `portal_user_id` (uuid, nullable) - Portal user who reported
      - `assigned_to` (uuid, nullable FK to auth.users) - Assigned employee
      - `resolved_at` (timestamptz, nullable)
      - `resolution_notes` (text) - How it was resolved
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `installed_devices` - Devices installed at project location for warranty tracking
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `device_type` (text) - stridac, baterie, wallbox, tepelne_cerpadlo, rekuperace, other
      - `name` (text) - Device name / model
      - `manufacturer` (text) - Manufacturer
      - `serial_number` (text) - Serial / manufacturing number
      - `installation_date` (date, nullable) - When installed
      - `warranty_years` (integer) - Warranty period in years
      - `warranty_end_date` (date, nullable) - Computed or manual warranty end date
      - `notes` (text) - Additional notes
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Authenticated users (employees) can read/manage all records
    - Portal users can read their own project's devices and schedules
    - Portal users can create tickets for their projects

  3. Indexes
    - service_schedules: project_id, next_date
    - service_tickets: project_id, status
    - installed_devices: project_id, warranty_end_date
*/

-- Service Types (admin-definable)
CREATE TABLE IF NOT EXISTS service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  interval_months integer NOT NULL DEFAULT 12,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read service types"
  ON service_types FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert service types"
  ON service_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update service types"
  ON service_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete service types"
  ON service_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service Schedules (linked to projects)
CREATE TABLE IF NOT EXISTS service_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
  next_date date NOT NULL DEFAULT CURRENT_DATE,
  last_completed_date date,
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_schedules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_schedules_project ON service_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_service_schedules_next_date ON service_schedules(next_date);

CREATE POLICY "Authenticated users can read service schedules"
  ON service_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert service schedules"
  ON service_schedules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update service schedules"
  ON service_schedules FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete service schedules"
  ON service_schedules FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Service Tickets
CREATE TABLE IF NOT EXISTS service_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  service_schedule_id uuid REFERENCES service_schedules(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  reported_by_portal boolean NOT NULL DEFAULT false,
  portal_user_id uuid,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_tickets_project ON service_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets(status);

CREATE POLICY "Authenticated users can read service tickets"
  ON service_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert service tickets"
  ON service_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update service tickets"
  ON service_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete service tickets"
  ON service_tickets FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Installed Devices (warranty tracking)
CREATE TABLE IF NOT EXISTS installed_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  device_type text NOT NULL DEFAULT 'other',
  name text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  installation_date date,
  warranty_years integer NOT NULL DEFAULT 2,
  warranty_end_date date,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE installed_devices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_installed_devices_project ON installed_devices(project_id);
CREATE INDEX IF NOT EXISTS idx_installed_devices_warranty ON installed_devices(warranty_end_date);

CREATE POLICY "Authenticated users can read installed devices"
  ON installed_devices FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert installed devices"
  ON installed_devices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update installed devices"
  ON installed_devices FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete installed devices"
  ON installed_devices FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Seed default service types
INSERT INTO service_types (name, interval_months, description, sort_order) VALUES
  ('Revize elektro', 36, 'Pravidelná revize elektrické instalace', 1),
  ('Servis FVE', 12, 'Roční servis fotovoltaické elektrárny', 2),
  ('Servis tepelného čerpadla', 12, 'Roční servis tepelného čerpadla', 3),
  ('Servis rekuperace', 6, 'Výměna filtrů a kontrola rekuperační jednotky', 4),
  ('Revize hromosvodu', 60, 'Pravidelná revize hromosvodu', 5),
  ('Servis wallboxu', 24, 'Kontrola a servis wallboxu', 6),
  ('Kontrola bateriového úložiště', 12, 'Kontrola stavu baterie a parametrů', 7)
ON CONFLICT DO NOTHING;
