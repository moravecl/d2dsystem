/*
  # Add installation date and custom interval to service_schedules

  1. Modified Tables
    - `service_schedules`
      - `installation_date` (date, nullable) - Date the system was installed
      - `interval_months` (integer, default 12) - Custom repeat interval in months

  2. Notes
    - next_date is now computed from installation_date + interval_months on the frontend
    - Existing rows keep their current next_date values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'installation_date'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN installation_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'interval_months'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN interval_months integer NOT NULL DEFAULT 12;
  END IF;
END $$;
