/*
  # Create sticky_notes table

  Personal quick notes ("listecky") for each user, visible only on their dashboard.

  ## New Tables
  - `sticky_notes`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users) - owner
    - `org_id` (uuid, FK to organizations) - for org isolation
    - `content` (text) - note content
    - `color` (text) - note color
    - `position` (int) - display order
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only CRUD their own notes
*/

CREATE TABLE IF NOT EXISTS sticky_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_id ON sticky_notes(user_id);

ALTER TABLE sticky_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own sticky notes"
  ON sticky_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sticky notes"
  ON sticky_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sticky notes"
  ON sticky_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sticky notes"
  ON sticky_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';