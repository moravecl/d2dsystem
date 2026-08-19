/*
  # Create uploads storage bucket and policies

  1. Storage
    - Create `uploads` bucket (public, 50MB limit)
    - Allow authenticated users to upload files
    - Allow public read access for shared files
    - Allow authenticated users to delete their own files

  2. Notes
    - Bucket was pre-created via SQL; this migration adds RLS policies
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', true, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to uploads bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Anyone can read uploads bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'uploads');

CREATE POLICY "Public can read uploads bucket"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can update own uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'uploads' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can delete own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'uploads' AND auth.uid() = owner);
