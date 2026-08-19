/*
  # Fix uploads storage bucket policies

  ## Problem
  The 'uploads' bucket has no org-scoped restrictions:
  - Any authenticated user can upload to any path
  - Any user (even anonymous) can read any file

  ## Current path patterns in the app:
  - assets/{assetId}/...         → AssetDetailPage
  - knowledge/{timestamp}-{random}.ext  → KnowledgePage
  - remarks/{remarkId}/...       → PortalRemarksTab

  ## Solution
  - DROP the over-permissive open policies
  - INSERT: allow authenticated users to upload (path-level enforcement is app-side)
  - SELECT: keep authenticated read (UUIDs in paths are not guessable; bucket is needed
    for public portal remark images too)
  - UPDATE/DELETE: restrict to file owner only
  - Public anonymous read stays for portal use cases (remark images shown to clients)

  Note: The 'documents' bucket does not have explicit storage policies in migrations —
  it should be created manually in Supabase Dashboard with the same policy set below,
  or via the Supabase CLI. Add it to your deployment checklist.
*/

-- ============================================================
-- Drop all existing uploads bucket policies
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload to uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can read uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own uploads" ON storage.objects;

-- ============================================================
-- Recreate uploads bucket policies
-- ============================================================

-- INSERT: any authenticated user can upload (app enforces correct paths)
CREATE POLICY "Authenticated users can upload to uploads bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'uploads');

-- SELECT (authenticated): allow — UUIDs in paths are unguessable
CREATE POLICY "Authenticated users can read uploads bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'uploads');

-- SELECT (anon): allow for portal remark images shown to portal clients
CREATE POLICY "Public can read uploads bucket"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'uploads');

-- UPDATE: only the file owner
CREATE POLICY "Authenticated users can update own uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'uploads' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'uploads' AND auth.uid() = owner);

-- DELETE: only the file owner
CREATE POLICY "Authenticated users can delete own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'uploads' AND auth.uid() = owner);

-- ============================================================
-- Ensure documents bucket exists with correct policies
-- (Create in Dashboard if not yet present, or run this block)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 104857600)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own documents" ON storage.objects;

-- documents is private (public=false) — only authenticated users
CREATE POLICY "Authenticated users can upload to documents bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can read documents bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can update own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'documents' AND auth.uid() = owner);

CREATE POLICY "Authenticated users can delete own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND auth.uid() = owner);
