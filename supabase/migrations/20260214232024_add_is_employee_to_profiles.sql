/*
  # Add is_employee flag to profiles

  1. Changes
    - Add `is_employee` boolean column to `profiles` table
    - Default value is `false`
    - This flag is used to mark users who can be selected as workers in worklog entries

  2. Notes
    - This allows admin to designate which users are employees
    - Only employees can be assigned to worklog entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_employee'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_employee boolean DEFAULT false NOT NULL;
  END IF;
END $$;
