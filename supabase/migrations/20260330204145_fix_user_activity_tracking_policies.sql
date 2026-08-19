
/*
  # Fix user_activity_log policies - drop and recreate safely
*/

DROP POLICY IF EXISTS "Users can insert own activity" ON user_activity_log;
DROP POLICY IF EXISTS "Superadmins can view all activity" ON user_activity_log;
DROP POLICY IF EXISTS "Superadmins can delete activity" ON user_activity_log;

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
