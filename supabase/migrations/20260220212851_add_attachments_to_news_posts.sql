/*
  # Add image and file attachments to news posts

  1. Modified Tables
    - `news_posts`
      - `image_url` (text) - URL of attached image for preview
      - `attachments` (jsonb) - Array of file attachments [{name, url, size, mime_type}]

  2. Notes
    - image_url stores a single hero/preview image
    - attachments stores multiple file references as JSON array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_posts' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE news_posts ADD COLUMN image_url text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_posts' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE news_posts ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
