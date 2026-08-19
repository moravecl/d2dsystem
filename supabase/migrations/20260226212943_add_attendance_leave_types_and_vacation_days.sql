/*
  # Add Leave Types to Attendance and Vacation Days to Profiles

  1. Changes
    - Add `leave_type` column to attendance_records for tracking vacation, sick, doctor, unpaid leave
    - Add `vacation_days_per_year` column to profiles for setting annual vacation entitlement
    - Add `tasks_view_preference` column to dashboard_layouts for remembering kanban/list view

  2. Security
    - All existing RLS policies apply

  3. Notes
    - Leave types: work (default), vacation, sick, doctor, unpaid
    - vacation_days_per_year defaults to 20 (Czech standard)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'leave_type'
  ) THEN
    ALTER TABLE attendance_records ADD COLUMN leave_type text DEFAULT 'work';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'vacation_days_per_year'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vacation_days_per_year integer DEFAULT 20;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_layouts' AND column_name = 'tasks_view_preference'
  ) THEN
    ALTER TABLE dashboard_layouts ADD COLUMN tasks_view_preference text DEFAULT 'kanban';
  END IF;
END $$;

COMMENT ON COLUMN attendance_records.leave_type IS 'Type of leave: work, vacation, sick, doctor, unpaid';
COMMENT ON COLUMN profiles.vacation_days_per_year IS 'Annual vacation entitlement in days';
COMMENT ON COLUMN dashboard_layouts.tasks_view_preference IS 'Preferred view for tasks: kanban or list';
