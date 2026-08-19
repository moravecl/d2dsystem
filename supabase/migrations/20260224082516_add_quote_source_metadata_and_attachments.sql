/*
  # Add source metadata and attachments to project quotes

  1. Modified Tables
    - `project_quotes`
      - `source_type` (text, nullable) - identifies quote origin: 'manual', 'fve', 'camera', 'mixed'
      - `source_metadata` (jsonb, nullable) - stores configurator references (design ID, version, system summary)
      - `attachments` (jsonb, nullable) - stores visual previews (roof snapshots, camera layout images, editable annotations)

  2. Important Notes
    - These columns enable bidirectional linking between configurators and quotes
    - source_metadata stores design IDs for "update from configurator" functionality
    - attachments stores base64 image snapshots and editable summary data
    - All columns are nullable to maintain backward compatibility with existing quotes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_quotes' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE project_quotes ADD COLUMN source_type text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_quotes' AND column_name = 'source_metadata'
  ) THEN
    ALTER TABLE project_quotes ADD COLUMN source_metadata jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_quotes' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE project_quotes ADD COLUMN attachments jsonb DEFAULT NULL;
  END IF;
END $$;
