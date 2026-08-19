/*
  # Add page_path, org_id alias and session_id to user_activity_log

  1. Changes
    - Add `page_path` column (text, nullable) to store visited URL paths
    - Add `org_id` column (uuid, nullable) as an alias-friendly column
    - Add `session_id` column (text, nullable) for session tracking

  2. Notes
    - Uses IF NOT EXISTS pattern to be safe
    - Existing data is preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_activity_log' AND column_name = 'page_path'
  ) THEN
    ALTER TABLE user_activity_log ADD COLUMN page_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_activity_log' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE user_activity_log ADD COLUMN org_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_activity_log' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE user_activity_log ADD COLUMN session_id text;
  END IF;
END $$;
