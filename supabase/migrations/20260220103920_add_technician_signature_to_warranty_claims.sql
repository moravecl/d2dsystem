/*
  # Add technician signature to warranty claims

  1. Modified Tables
    - `warranty_claims`
      - `technician_signature` (text) - base64 encoded signature image from technician
      - `technician_signed_at` (timestamptz) - when technician signed

  2. Notes
    - Allows both customer and technician to sign the warranty claim protocol
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warranty_claims' AND column_name = 'technician_signature'
  ) THEN
    ALTER TABLE warranty_claims ADD COLUMN technician_signature text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warranty_claims' AND column_name = 'technician_signed_at'
  ) THEN
    ALTER TABLE warranty_claims ADD COLUMN technician_signed_at timestamptz;
  END IF;
END $$;
