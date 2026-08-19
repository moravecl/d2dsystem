/*
  # Create user_sidebar_settings table with group support

  This migration adds per-user sidebar customization with support for custom groups.
  Each user can create their own groups (rolldown menus) and organize sidebar items.

  1. New Tables
    - `user_sidebar_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) - unique per user
      - `organization_id` (uuid, FK to organizations)
      - `items` (jsonb) - ordered array of sidebar items with group assignments
      - `groups` (jsonb) - array of custom groups with id, name, icon, expanded state
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Data Structure
    - items: [{ key: string, visible: boolean, groupId: string | null }]
    - groups: [{ id: string, name: string, icon: string, expanded: boolean }]

  3. Security
    - Enable RLS
    - Users can only read/write their own settings
*/

CREATE TABLE IF NOT EXISTS user_sidebar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_sidebar_settings_user_org_unique UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sidebar_settings_user ON user_sidebar_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sidebar_settings_org ON user_sidebar_settings(organization_id);

ALTER TABLE user_sidebar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sidebar settings"
  ON user_sidebar_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sidebar settings"
  ON user_sidebar_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sidebar settings"
  ON user_sidebar_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sidebar settings"
  ON user_sidebar_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
