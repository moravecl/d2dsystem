/*
  # Add form_type to inquiry_forms and create form-uploads storage bucket

  1. Modified Tables
    - `inquiry_forms`
      - Add `form_type` column (text, default 'inquiry')
        - 'inquiry' = submission goes to leads table
        - 'service' = submission goes to service_tickets table

  2. Storage
    - Create `form-uploads` bucket for file attachments from public forms

  3. Notes
    - Existing forms default to 'inquiry' type (backward compatible)
    - The form-uploads bucket is public so embed scripts can upload files
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inquiry_forms' AND column_name = 'form_type'
  ) THEN
    ALTER TABLE inquiry_forms ADD COLUMN form_type text NOT NULL DEFAULT 'inquiry';
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('form-uploads', 'form-uploads', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload form files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can upload form files"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'form-uploads');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read form files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can read form files"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'form-uploads');
  END IF;
END $$;
