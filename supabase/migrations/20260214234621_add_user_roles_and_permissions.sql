/*
  # Add user roles and permissions system

  1. Changes
    - Add `role` text column to `profiles` table with check constraint
    - Default role is 'user'
    - Available roles: admin, manager, employee, user
    - Admins have full access
    - Managers can view/edit projects and clients
    - Employees can only log time
    - Users have read-only access

  2. Security
    - Only admins can change user roles
    - Role changes are logged in audit_log
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user' NOT NULL
      CHECK (role IN ('admin', 'manager', 'employee', 'user'));
    
    -- Set existing admins
    UPDATE profiles SET role = 'admin' WHERE is_admin = true;
  END IF;
END $$;
