/*
  # Add panel gap fields to fv_panels

  ## Changes
  - Adds `gap_h_mm` (horizontal gap between panels in mm) to `fv_panels` table, default 20mm
  - Adds `gap_v_mm` (vertical gap between panels in mm) to `fv_panels` table, default 20mm

  These gaps are used in the visual roof canvas to correctly space panels in the auto-fill grid mode.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_panels' AND column_name = 'gap_h_mm'
  ) THEN
    ALTER TABLE fv_panels ADD COLUMN gap_h_mm integer NOT NULL DEFAULT 20;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_panels' AND column_name = 'gap_v_mm'
  ) THEN
    ALTER TABLE fv_panels ADD COLUMN gap_v_mm integer NOT NULL DEFAULT 20;
  END IF;
END $$;
