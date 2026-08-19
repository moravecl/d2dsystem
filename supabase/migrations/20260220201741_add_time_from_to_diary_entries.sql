/*
  # Add time_from and time_to to diary entries

  1. Modified Tables
    - `job_diary_entries`
      - `time_from` (time) - start time of work on site
      - `time_to` (time) - end time of work on site

  2. Notes
    - Both fields are nullable for backwards compatibility with existing entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_diary_entries' AND column_name = 'time_from'
  ) THEN
    ALTER TABLE job_diary_entries ADD COLUMN time_from time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_diary_entries' AND column_name = 'time_to'
  ) THEN
    ALTER TABLE job_diary_entries ADD COLUMN time_to time;
  END IF;
END $$;
