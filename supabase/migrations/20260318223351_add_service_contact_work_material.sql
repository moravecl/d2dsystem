/*
  # Extend Service Schedules with Contact Info, GPS, and Work/Material Entries

  1. Modified Tables
    - `service_schedules`
      - `client_phone` (text) - Customer phone number
      - `client_email` (text) - Customer email
      - `client_ico` (text) - Customer business ID (ICO)
      - `client_dic` (text) - Customer tax ID (DIC)
      - `address_lat` (numeric) - GPS latitude for map display
      - `address_lon` (numeric) - GPS longitude for map display

  2. New Tables
    - `service_work_entries` - Work log entries for services (like quick_job_work_entries)
      - `id` (uuid, primary key)
      - `schedule_id` (uuid, FK to service_schedules)
      - `worker_name` (text) - Worker/technician name
      - `hours` (numeric) - Hours worked
      - `hourly_rate` (numeric) - Hourly rate
      - `description` (text) - Work description
      - `work_date` (date) - Date of work
      - `created_at` (timestamptz)

    - `service_material_entries` - Material entries for services (like quick_job_material_entries)
      - `id` (uuid, primary key)
      - `schedule_id` (uuid, FK to service_schedules)
      - `material_name` (text) - Material name
      - `quantity` (numeric) - Quantity used
      - `unit` (text) - Unit (ks, m, etc.)
      - `unit_price` (numeric) - Selling price per unit
      - `purchase_price` (numeric) - Purchase cost per unit
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on new tables
    - Authenticated users can CRUD entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'client_phone'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN client_phone text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN client_email text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'client_ico'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN client_ico text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'client_dic'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN client_dic text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'address_lat'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN address_lat numeric(10,7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'address_lon'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN address_lon numeric(10,7);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_work_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES service_schedules(id) ON DELETE CASCADE,
  worker_name text NOT NULL DEFAULT '',
  hours numeric(6,2) NOT NULL DEFAULT 0,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_work_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_work_entries_schedule ON service_work_entries(schedule_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_work_entries' AND policyname = 'Auth users can read service work entries'
  ) THEN
    CREATE POLICY "Auth users can read service work entries"
      ON service_work_entries FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_work_entries' AND policyname = 'Auth users can insert service work entries'
  ) THEN
    CREATE POLICY "Auth users can insert service work entries"
      ON service_work_entries FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_work_entries' AND policyname = 'Auth users can update service work entries'
  ) THEN
    CREATE POLICY "Auth users can update service work entries"
      ON service_work_entries FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_work_entries' AND policyname = 'Auth users can delete service work entries'
  ) THEN
    CREATE POLICY "Auth users can delete service work entries"
      ON service_work_entries FOR DELETE
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_material_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES service_schedules(id) ON DELETE CASCADE,
  material_name text NOT NULL DEFAULT '',
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ks',
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  purchase_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_material_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_material_entries_schedule ON service_material_entries(schedule_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_material_entries' AND policyname = 'Auth users can read service material entries'
  ) THEN
    CREATE POLICY "Auth users can read service material entries"
      ON service_material_entries FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_material_entries' AND policyname = 'Auth users can insert service material entries'
  ) THEN
    CREATE POLICY "Auth users can insert service material entries"
      ON service_material_entries FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_material_entries' AND policyname = 'Auth users can update service material entries'
  ) THEN
    CREATE POLICY "Auth users can update service material entries"
      ON service_material_entries FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_material_entries' AND policyname = 'Auth users can delete service material entries'
  ) THEN
    CREATE POLICY "Auth users can delete service material entries"
      ON service_material_entries FOR DELETE
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN service_schedules.client_phone IS 'Customer phone number for contact';
COMMENT ON COLUMN service_schedules.client_email IS 'Customer email for contact';
COMMENT ON COLUMN service_schedules.client_ico IS 'Customer business identification number (ICO)';
COMMENT ON COLUMN service_schedules.client_dic IS 'Customer tax identification number (DIC)';
COMMENT ON COLUMN service_schedules.address_lat IS 'GPS latitude of service location';
COMMENT ON COLUMN service_schedules.address_lon IS 'GPS longitude of service location';
COMMENT ON TABLE service_work_entries IS 'Work log entries for service schedules';
COMMENT ON TABLE service_material_entries IS 'Material entries used for service schedules';
