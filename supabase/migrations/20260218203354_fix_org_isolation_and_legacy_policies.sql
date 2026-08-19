/*
  # Fix organization data isolation

  ## Problem
  1. get_my_organization_id() reads from profiles.organization_id which is not
     reliably set - actual membership is tracked in organization_members table.
  2. Several legacy SELECT policies on projects and clients allow any
     authenticated user or any admin to see ALL data regardless of org.

  ## Fix
  1. Rewrite get_my_organization_id() to use organization_members table.
  2. Drop legacy over-permissive policies on projects and clients.
  3. Drop "Authenticated users can view all clients" policy.
*/

-- 1. Fix get_my_organization_id to use organization_members (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 2. Drop legacy over-permissive project policies
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Users can read projects based on role" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;

-- 3. Drop legacy over-permissive client policies
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;

-- 4. Ensure clean org-scoped policies exist on projects
DROP POLICY IF EXISTS "Org members can view projects" ON projects;
DROP POLICY IF EXISTS "Org members can insert projects" ON projects;
DROP POLICY IF EXISTS "Org members can update projects" ON projects;
DROP POLICY IF EXISTS "Org members can delete projects" ON projects;

CREATE POLICY "Org members can view projects"
  ON projects FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org members can insert projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- Keep portal client access
DROP POLICY IF EXISTS "Clients can view their assigned projects" ON projects;
CREATE POLICY "Clients can view their assigned projects"
  ON projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'client'
        AND profiles.client_id = projects.client_id
    )
  );

-- 5. Ensure clean org-scoped policies exist on clients
DROP POLICY IF EXISTS "Org members can view clients" ON clients;
DROP POLICY IF EXISTS "Org members can insert clients" ON clients;
DROP POLICY IF EXISTS "Org members can update clients" ON clients;
DROP POLICY IF EXISTS "Org members can delete clients" ON clients;

CREATE POLICY "Org members can view clients"
  ON clients FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org members can insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can update clients"
  ON clients FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete clients"
  ON clients FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());
