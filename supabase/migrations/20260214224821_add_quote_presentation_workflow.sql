/*
  # Add quote presentation workflow

  1. Modified Tables
    - `project_quotes`
      - `presented_to_client` (boolean, default false) - whether quote is visible to client
      - `presented_at` (timestamptz, nullable) - when the quote was presented

  2. Notes
    - Quotes start as drafts (presented_to_client = false)
    - Admin explicitly presents quotes to client
    - Client portal only sees presented quotes
    - Status flow: draft -> presented -> approved/returned
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_quotes' AND column_name = 'presented_to_client'
  ) THEN
    ALTER TABLE project_quotes ADD COLUMN presented_to_client boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_quotes' AND column_name = 'presented_at'
  ) THEN
    ALTER TABLE project_quotes ADD COLUMN presented_at timestamptz;
  END IF;
END $$;
