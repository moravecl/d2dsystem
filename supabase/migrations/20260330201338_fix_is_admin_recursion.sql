
/*
  # Fix is_admin function infinite recursion

  ## Problem
  The `is_admin` function queries the `profiles` table, which has an RLS policy
  that calls `is_admin` — causing infinite recursion and "Database error querying schema".

  ## Fix
  Recreate `is_admin` as SECURITY DEFINER so it bypasses RLS when checking profiles.
*/

CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin'
  );
$$;
