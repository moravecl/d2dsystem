/*
  # Add employees table, worklog workers, and fix admin quote comments

  1. Security Changes
    - Add SELECT policy on `quote_comments` for admin users
      so they can see all comments on any quote
    - Add INSERT policy on `quote_comments` for admin users

  2. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `user_id` (uuid, owner reference to auth.users)
      - `name` (text, employee full name)
      - `position` (text, job title/role)
      - `phone` (text, optional contact)
      - `hourly_rate` (numeric, optional hourly rate)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)

  3. Modified Tables
    - `job_worklogs`
      - Add `workers` (jsonb, array of worker objects with name, employee_id, type)

  4. Security
    - Enable RLS on `employees`
    - Admin-only CRUD policies on employees
    - Authenticated read on employees for worker selection
*/

-- 1. Admin policy for quote_comments (so admins see client comments)
CREATE POLICY "Admins can view all quote comments"
  ON quote_comments
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert quote comments"
  ON quote_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_admin(auth.uid())
  );

-- 2. Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  hourly_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employees"
  ON employees
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins can insert employees"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update employees"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete employees"
  ON employees
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- 3. Workers column on job_worklogs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_worklogs' AND column_name = 'workers'
  ) THEN
    ALTER TABLE job_worklogs ADD COLUMN workers jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
