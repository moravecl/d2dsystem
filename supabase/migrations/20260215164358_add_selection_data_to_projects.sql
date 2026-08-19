/*
  # Add selection_data column to projects

  1. Modified Tables
    - `projects`
      - Added `selection_data` (jsonb, nullable) - stores the full SelectionState as JSON for atomic save/load
  
  2. Purpose
    - Eliminates race condition when saving pins via delete-then-insert pattern
    - Pins and selections are now saved atomically alongside floor data
    - Backward compatible: falls back to pin_placements/project_selections if selection_data is null
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'selection_data'
  ) THEN
    ALTER TABLE projects ADD COLUMN selection_data jsonb DEFAULT NULL;
  END IF;
END $$;
