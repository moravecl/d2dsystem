/*
  # Add portal_user_id to clients table

  1. Modified Tables
    - `clients`
      - `portal_user_id` (uuid, nullable) - references the auth user created for the client portal

  2. Notes
    - Links a client record to their portal login account in auth.users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'portal_user_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN portal_user_id uuid;
  END IF;
END $$;
