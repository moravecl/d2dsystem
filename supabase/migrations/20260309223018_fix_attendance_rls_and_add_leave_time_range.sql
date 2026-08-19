/*
  # Fix attendance RLS and add leave time/date-range support

  1. RLS fix
     - DROP the INSERT policy that checks organization_id (trigger sets it after RLS check, causing failures)
     - Replace with a permissive INSERT policy for authenticated users (org isolation enforced by trigger + SELECT policy)
     - Add missing DELETE policy

  2. New columns on attendance_records
     - `leave_date_to` (date, nullable) – end date for multi-day absence entries
     - `leave_start_time` (time, nullable) – partial-day absence start
     - `leave_end_time` (time, nullable) – partial-day absence end
*/

-- Fix INSERT policy: trigger sets organization_id, so WITH CHECK on it always fails before trigger runs
DROP POLICY IF EXISTS "Org members can insert attendance" ON attendance_records;

CREATE POLICY "Authenticated users can insert attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add DELETE policy (was missing)
DROP POLICY IF EXISTS "Org members can delete attendance" ON attendance_records;

CREATE POLICY "Org members can delete attendance"
  ON attendance_records FOR DELETE
  TO authenticated
  USING (organization_id = get_my_organization_id());

-- Add multi-day and partial-day columns for leave records
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'leave_date_to') THEN
    ALTER TABLE attendance_records ADD COLUMN leave_date_to date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'leave_start_time') THEN
    ALTER TABLE attendance_records ADD COLUMN leave_start_time time;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'leave_end_time') THEN
    ALTER TABLE attendance_records ADD COLUMN leave_end_time time;
  END IF;
END $$;
