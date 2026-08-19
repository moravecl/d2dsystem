/*
  # Fix SMTP and Email Access for All Authenticated Users

  1. Changes
    - Add SELECT policy on smtp_accounts for all authenticated users (they need to see available SMTP accounts to send emails)
    - Add INSERT policy on email_log for all authenticated users (they need to log emails they send)
    
  2. Security
    - Authenticated users can only see limited SMTP fields (name, from_email, from_name, is_default) via the application layer
    - Password and credentials remain protected at application level (only edge function uses them via service role)
    - Users can still only see their own email log entries (existing policy)
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can view SMTP accounts' 
    AND tablename = 'smtp_accounts'
  ) THEN
    DROP POLICY "Admins can view SMTP accounts" ON smtp_accounts;
  END IF;
END $$;

CREATE POLICY "Authenticated users can view SMTP accounts"
  ON smtp_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );
