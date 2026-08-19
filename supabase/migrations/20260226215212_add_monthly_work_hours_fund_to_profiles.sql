/*
  # Add Monthly Work Hours Fund to Profiles

  1. Changes
    - Add `monthly_work_hours_fund` column to profiles for storing contracted monthly hours
    - Default is 160 hours (standard full-time 40h/week * 4 weeks)

  2. Notes
    - This allows tracking overtime vs contracted hours
    - Admin can set different values for part-time employees
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'monthly_work_hours_fund'
  ) THEN
    ALTER TABLE profiles ADD COLUMN monthly_work_hours_fund numeric DEFAULT 160;
  END IF;
END $$;

COMMENT ON COLUMN profiles.monthly_work_hours_fund IS 'Contracted monthly work hours (e.g., 160 for full-time)';
