/*
  # Enhance projects with status, description, and quote data

  1. Changes to `projects` table
    - `status` (text, default 'draft') - project status: draft, in_progress, completed, sent
    - `description` (text, default '') - version description/notes
    - `quote_data` (jsonb) - stored quote sections and items

  2. Description
    - Allows tracking project lifecycle with statuses
    - Each saved version can have a description explaining what changed
    - Quote data is persisted alongside project data so it survives across sessions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'status'
  ) THEN
    ALTER TABLE projects ADD COLUMN status text NOT NULL DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'description'
  ) THEN
    ALTER TABLE projects ADD COLUMN description text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'quote_data'
  ) THEN
    ALTER TABLE projects ADD COLUMN quote_data jsonb;
  END IF;
END $$;