/*
  # Fix infinite recursion in profiles RLS policy

  1. Changes
    - Create a `is_admin` helper function with SECURITY DEFINER to bypass RLS
    - Drop the recursive "Admins can read all profiles" policy
    - Re-create it using the helper function to avoid infinite recursion

  2. Security
    - The `is_admin` function uses SECURITY DEFINER to safely check the profiles
      table without triggering RLS policies
    - Function is restricted to authenticated role only
*/

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
