/*
  # Standalone Service Protocol Support

  Makes service_protocols.project_id nullable and adds client info columns
  so protocols can be created for service schedules not linked to a project.

  ## Changes
  - `service_protocols.project_id` - changed from NOT NULL to nullable
  - Added `client_name` (text) - for standalone (no-project) protocols
  - Added `client_address` (text) - for standalone (no-project) protocols

  ## Notes
  - Existing records are unaffected (they have project_id set)
  - New protocols for standalone services will have project_id = NULL
    and client_name filled in from the service schedule
*/

ALTER TABLE service_protocols
  ALTER COLUMN project_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_protocols' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE service_protocols ADD COLUMN client_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_protocols' AND column_name = 'client_address'
  ) THEN
    ALTER TABLE service_protocols ADD COLUMN client_address text;
  END IF;
END $$;
