/*
  # Add montaz start date to projects and offset-based milestone scheduling

  1. Changes to `projects`
    - `montaz_start_date` (date, nullable) - The planned start date for montaz/installation
    - When set, milestone dates are calculated as: montaz_start_date + offset_days

  2. Changes to `project_milestones`
    - `offset_days` (integer, default 0) - Number of days from project's montaz_start_date
    - `duration_days` (integer, default 7) - Duration of the milestone in days

  3. Notes
    - Existing milestones keep their start_date/end_date unchanged
    - offset_days defaults to 0, duration_days defaults to 7
    - When montaz_start_date is set on the project, start_date = montaz_start_date + offset_days, end_date = start_date + duration_days
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'montaz_start_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN montaz_start_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_milestones' AND column_name = 'offset_days'
  ) THEN
    ALTER TABLE project_milestones ADD COLUMN offset_days integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_milestones' AND column_name = 'duration_days'
  ) THEN
    ALTER TABLE project_milestones ADD COLUMN duration_days integer NOT NULL DEFAULT 7;
  END IF;
END $$;
