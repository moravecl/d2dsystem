/*
  # Decouple jobs from approved quotes & add material source tracking

  1. Changes to `jobs` table
    - Make `quote_id` nullable so jobs can exist without a quote
    - Change FK from ON DELETE CASCADE to ON DELETE SET NULL (prevents data loss)

  2. Changes to `job_material_entries` table
    - Add `source_quote_id` (uuid, nullable) to track which quote each material entry came from
    - Add `trade` (text, nullable) to store trade grouping directly on entries
    - FK on source_quote_id with ON DELETE SET NULL

  3. Security
    - No RLS changes needed (existing policies cover these columns)

  4. Important notes
    - The CASCADE → SET NULL change is critical: previously deleting a quote
      would cascade-delete the entire job and all its worklogs, materials, diary entries
    - Now deleting a quote just nullifies the reference, preserving all execution data
*/

-- 1. Make jobs.quote_id nullable
ALTER TABLE jobs ALTER COLUMN quote_id DROP NOT NULL;

-- 2. Drop the old CASCADE FK and recreate with SET NULL
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_quote_id_fkey;
ALTER TABLE jobs ADD CONSTRAINT jobs_quote_id_fkey
  FOREIGN KEY (quote_id) REFERENCES project_quotes(id) ON DELETE SET NULL;

-- 3. Add source_quote_id to job_material_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_material_entries' AND column_name = 'source_quote_id'
  ) THEN
    ALTER TABLE job_material_entries ADD COLUMN source_quote_id uuid
      REFERENCES project_quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Add trade column to job_material_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_material_entries' AND column_name = 'trade'
  ) THEN
    ALTER TABLE job_material_entries ADD COLUMN trade text;
  END IF;
END $$;
