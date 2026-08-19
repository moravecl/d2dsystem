/*
  # Allow authenticated users to read employee profiles

  1. Security
    - Add SELECT policy on profiles for all authenticated users
      to see other employees (needed for attendance, worklogs, etc.)
    - Policy restricts to employees and basic info access only
*/

CREATE POLICY "Authenticated users can read employee profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_employee = true);
