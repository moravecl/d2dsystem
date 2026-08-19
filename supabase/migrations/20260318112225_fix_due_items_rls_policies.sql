/*
  # Fix Due Items RLS Policies

  ## Problem
  The `due_items` table is missing SELECT, UPDATE, and DELETE policies which prevents
  users from viewing or modifying due items (asset deadlines like STK, revisions, etc).

  ## Changes
  1. Add SELECT policy for authenticated users to view due items
  2. Add UPDATE policy for authenticated users to modify due items
  3. Add DELETE policy for admins

  ## Tables Affected
  - `due_items`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can view due items' AND polrelid = 'due_items'::regclass
  ) THEN
    CREATE POLICY "Authenticated users can view due items"
      ON due_items FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can update due items' AND polrelid = 'due_items'::regclass
  ) THEN
    CREATE POLICY "Authenticated users can update due items"
      ON due_items FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins can delete due items' AND polrelid = 'due_items'::regclass
  ) THEN
    CREATE POLICY "Admins can delete due items"
      ON due_items FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;
END $$;