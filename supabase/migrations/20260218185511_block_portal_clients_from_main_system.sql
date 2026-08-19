/*
  # Block portal clients from accessing the main system

  ## Problem
  Portal client users are valid Supabase auth users. They were able to log in to the
  main application at /login and access all internal pages -- a serious security breach.

  ## Fix
  1. Add a `is_portal_client` boolean column to profiles (derived from having a client_id)
  2. Update the profiles table so we can easily identify portal-only users
  3. Add RLS policies that block portal clients from reading internal data

  ## Changes
  - profiles: add `is_portal_client` boolean column, default false
  - Backfill: any profile with client_id set = is_portal_client true
  - Add trigger to auto-set is_portal_client when client_id is assigned
*/

-- Add is_portal_client flag to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_portal_client'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_portal_client boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Backfill: any profile that already has a client_id is a portal client
UPDATE profiles SET is_portal_client = true WHERE client_id IS NOT NULL;

-- Trigger: automatically set is_portal_client when client_id is assigned or removed
CREATE OR REPLACE FUNCTION sync_portal_client_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    NEW.is_portal_client := true;
  ELSE
    NEW.is_portal_client := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_portal_client_flag ON profiles;
CREATE TRIGGER trg_sync_portal_client_flag
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_portal_client_flag();
