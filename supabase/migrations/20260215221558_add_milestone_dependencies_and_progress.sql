/*
  # Add milestone dependencies and progress tracking

  1. Modified Tables
    - `project_milestones`
      - `depends_on` (uuid array) - IDs of milestones this milestone depends on
      - `progress` (integer 0-100) - completion percentage of the milestone

  2. Important Notes
    - `depends_on` defaults to empty array
    - `progress` defaults to 0 and is constrained between 0 and 100
    - These columns enable dependency arrows and progress bars in the Gantt chart
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_milestones' AND column_name = 'depends_on'
  ) THEN
    ALTER TABLE project_milestones ADD COLUMN depends_on uuid[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_milestones' AND column_name = 'progress'
  ) THEN
    ALTER TABLE project_milestones ADD COLUMN progress integer NOT NULL DEFAULT 0
      CONSTRAINT progress_range CHECK (progress >= 0 AND progress <= 100);
  END IF;
END $$;