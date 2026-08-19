/*
  # Make project_id optional on service_schedules

  1. Modified Tables
    - `service_schedules`
      - `project_id` changed from NOT NULL to nullable
      - Added `client_name` (text) - name of client for schedules without a project
      - Added `client_address` (text) - address for schedules without a project
      - Added CHECK constraint: either project_id or client_name must be provided

  2. Important Notes
    - Existing records with project_id are not affected
    - New schedules can be created without a project by providing client_name instead
    - RLS policies remain unchanged (authenticated users can already CRUD)
*/

ALTER TABLE service_schedules
  ALTER COLUMN project_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN client_name text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'client_address'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN client_address text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_schedules_project_or_client'
  ) THEN
    ALTER TABLE service_schedules
      ADD CONSTRAINT service_schedules_project_or_client
      CHECK (project_id IS NOT NULL OR (client_name IS NOT NULL AND client_name <> ''));
  END IF;
END $$;
