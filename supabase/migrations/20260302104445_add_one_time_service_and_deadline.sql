/*
  # Add one-time service support and deadline to service_schedules

  1. Modified Tables
    - `service_schedules`
      - `is_one_time` (boolean, default false) - marks a service as one-time (e.g. warranty claim)
      - `deadline` (date, nullable) - optional maximum deadline for one-time services

  2. Notes
    - One-time services do not repeat after completion
    - Deadline is an optional "must be done by" date for one-time services
    - The scheduled_date (actual visit date) can still be set for planning
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'is_one_time'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN is_one_time boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'deadline'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN deadline date;
  END IF;
END $$;
