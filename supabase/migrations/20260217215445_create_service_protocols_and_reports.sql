/*
  # Create service protocols and work reports

  1. New Tables
    - `service_protocols`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `schedule_id` (uuid, nullable FK to service_schedules)
      - `ticket_id` (uuid, nullable FK to service_tickets)
      - `protocol_number` (text) - auto-generated protocol number
      - `service_date` (date) - when the service was performed
      - `technician_name` (text) - name of the technician
      - `description` (text) - what was done
      - `findings` (text) - inspection findings
      - `recommendations` (text) - recommendations for the client
      - `status` (text) - draft, completed
      - `created_by` (uuid, FK to auth.users)
      - `created_at`, `updated_at` (timestamptz)

    - `service_work_items`
      - `id` (uuid, primary key)
      - `protocol_id` (uuid, FK to service_protocols)
      - `type` (text) - 'labor' or 'material'
      - `description` (text) - item description
      - `quantity` (numeric) - amount
      - `unit` (text) - unit of measure (ks, hod, m, etc.)
      - `unit_price` (numeric) - price per unit
      - `total_price` (numeric) - computed total
      - `sort_order` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS service_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  schedule_id uuid REFERENCES service_schedules(id),
  ticket_id uuid REFERENCES service_tickets(id),
  protocol_number text NOT NULL DEFAULT '',
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  technician_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  findings text NOT NULL DEFAULT '',
  recommendations text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read service protocols"
  ON service_protocols FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert service protocols"
  ON service_protocols FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update service protocols"
  ON service_protocols FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete service protocols"
  ON service_protocols FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS service_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES service_protocols(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'labor',
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ks',
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read service work items"
  ON service_work_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert service work items"
  ON service_work_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update service work items"
  ON service_work_items FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete service work items"
  ON service_work_items FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
