/*
  # Add scheduled_date to service_schedules

  1. Modified Tables
    - `service_schedules`
      - `scheduled_date` (date, nullable) - The exact planned date for the next service visit
      - `scheduled_note` (text, default '') - Note for the scheduled visit

  2. Notes
    - `next_date` remains as the computed interval-based due date
    - `scheduled_date` is the actual confirmed appointment date set by the user
    - This date will be displayed in the calendar
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'scheduled_date'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN scheduled_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'scheduled_note'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN scheduled_note text DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_schedules_scheduled_date
  ON service_schedules (scheduled_date)
  WHERE scheduled_date IS NOT NULL;
