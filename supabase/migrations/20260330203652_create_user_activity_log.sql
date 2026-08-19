
/*
  # Create user activity log table

  ## New Tables
  - `user_activity_log`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles)
    - `organization_id` (uuid, optional)
    - `event_type` (text) - e.g. 'login', 'page_view', 'action'
    - `event_data` (jsonb) - optional metadata (page, action name, etc.)
    - `ip_address` (text, optional)
    - `user_agent` (text, optional)
    - `created_at` (timestamptz)

  ## Security
  - Enable RLS
  - Superadmins can view all
  - Users can insert their own activity
  - No user can read their own logs (only superadmin)
*/

CREATE TABLE IF NOT EXISTS user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'login',
  event_data jsonb DEFAULT '{}',
  ip_address text DEFAULT '',
  user_agent text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_event_type ON user_activity_log(event_type);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
  ON user_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Superadmins can view all activity"
  ON user_activity_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE superadmins.user_id = auth.uid()));

CREATE POLICY "Superadmins can delete activity"
  ON user_activity_log
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM superadmins WHERE superadmins.user_id = auth.uid()));
