/*
  # Add show_in_calendar flag to project milestones

  1. Modified Tables
    - `project_milestones`
      - `show_in_calendar` (boolean, default false) - controls whether the milestone is displayed on the calendar

  2. Notes
    - Existing milestones will default to false (not shown in calendar)
    - Users can opt-in milestones to calendar display from the milestone edit form
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_milestones' AND column_name = 'show_in_calendar'
  ) THEN
    ALTER TABLE project_milestones ADD COLUMN show_in_calendar boolean NOT NULL DEFAULT false;
  END IF;
END $$;
