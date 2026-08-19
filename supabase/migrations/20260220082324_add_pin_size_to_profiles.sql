/*
  # Add pin_size preference to profiles

  1. Modified Tables
    - `profiles`
      - `pin_size` (integer, default 16) - user preference for floorplan marker size in pixels

  2. Notes
    - Stores per-user floorplan designer pin/marker size preference
    - Default value is 16px
    - Persists across browsers and devices via database
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'pin_size'
  ) THEN
    ALTER TABLE profiles ADD COLUMN pin_size integer NOT NULL DEFAULT 16;
  END IF;
END $$;