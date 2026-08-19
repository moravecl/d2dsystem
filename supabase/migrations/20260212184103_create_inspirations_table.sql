/*
  # Create inspirations table for blog-like content

  1. New Tables
    - `inspirations`
      - `id` (uuid, primary key)
      - `title` (text) - article title
      - `slug` (text, unique) - URL-friendly identifier
      - `excerpt` (text) - short summary shown in listings
      - `content` (text) - full HTML content from rich text editor
      - `cover_image` (text) - main cover image URL
      - `is_published` (boolean) - whether visible to public
      - `author_id` (uuid, FK to auth.users) - who wrote it
      - `published_at` (timestamptz) - when it was published
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `inspirations`
    - Anyone (including anonymous) can read published inspirations
    - Only admins can create, update, and delete inspirations

  3. Notes
    - Content is stored as HTML produced by the admin rich text editor
    - Cover image is shown in listing cards and at top of detail page
    - Slug is used in public URLs for SEO-friendly links
*/

CREATE TABLE IF NOT EXISTS inspirations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  slug text UNIQUE NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_image text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inspirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published inspirations"
  ON inspirations
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can view all inspirations"
  ON inspirations
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert inspirations"
  ON inspirations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update inspirations"
  ON inspirations
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete inspirations"
  ON inspirations
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_inspirations_slug ON inspirations(slug);
CREATE INDEX IF NOT EXISTS idx_inspirations_published ON inspirations(is_published, published_at DESC);
