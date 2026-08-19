/*
  # Add GPS coordinates to projects

  1. Modified Tables
    - `projects`
      - `address_lat` (double precision, nullable) - Latitude from geocoded address
      - `address_lon` (double precision, nullable) - Longitude from geocoded address

  2. Notes
    - Coordinates are set when address is selected via autocomplete
    - Used for weather lookups in the construction diary
    - Nullable since existing projects may not have coordinates yet
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'address_lat'
  ) THEN
    ALTER TABLE projects ADD COLUMN address_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'address_lon'
  ) THEN
    ALTER TABLE projects ADD COLUMN address_lon double precision;
  END IF;
END $$;
