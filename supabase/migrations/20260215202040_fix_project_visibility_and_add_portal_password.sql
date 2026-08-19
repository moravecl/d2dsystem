/*
  # Fix Project Visibility and Add Portal Password Change

  1. Changes
    - Update projects RLS policy to allow admins and managers to see all projects
    - Users can still see their own projects
    - Add edge function for portal client password change

  2. Security
    - Maintains proper RLS
    - Only admins/managers can see all projects
    - Clients can only change their own portal password
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can read own projects" ON projects;

-- Create new policy that allows:
-- 1. Users to see their own projects
-- 2. Admins and managers to see all projects
CREATE POLICY "Users can read projects based on role"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );
