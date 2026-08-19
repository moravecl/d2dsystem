/*
  # Add groups support to sidebar_settings

  1. Modified Tables
    - `sidebar_settings`
      - Added `groups` (jsonb) - array of group objects with id, name, description, collapsed state

  2. Data Structure
    - groups: [{ id: string, name: string, description: string, collapsed: boolean }]

  3. Important Notes
    - Existing settings are not affected, they will use default groups from the app config
    - Groups allow admin to organize sidebar items into collapsible sections
    - Each group has a name and optional description shown as a label in the sidebar
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sidebar_settings' AND column_name = 'groups'
  ) THEN
    ALTER TABLE sidebar_settings ADD COLUMN groups jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
