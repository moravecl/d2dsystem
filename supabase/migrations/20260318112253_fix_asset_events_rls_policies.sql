/*
  # Fix Asset Events RLS Policies

  ## Problem
  The `asset_events` table is missing SELECT and DELETE policies which prevents
  users from viewing service history events.

  ## Changes
  1. Add SELECT policy for authenticated users to view asset events
  2. Add DELETE policy for admins

  ## Tables Affected
  - `asset_events`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can view asset events' AND polrelid = 'asset_events'::regclass
  ) THEN
    CREATE POLICY "Authenticated users can view asset events"
      ON asset_events FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins can delete asset events' AND polrelid = 'asset_events'::regclass
  ) THEN
    CREATE POLICY "Admins can delete asset events"
      ON asset_events FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;
END $$;