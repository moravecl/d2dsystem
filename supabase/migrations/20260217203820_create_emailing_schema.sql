/*
  # Create Emailing Module Schema

  1. New Tables
    - `smtp_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, owner who created the account)
      - `name` (text, friendly label like "Firemni SMTP")
      - `host` (text, SMTP server hostname)
      - `port` (integer, SMTP port)
      - `username` (text, SMTP login)
      - `password_encrypted` (text, encrypted SMTP password)
      - `from_email` (text, sender email address)
      - `from_name` (text, sender display name)
      - `use_tls` (boolean, whether to use TLS)
      - `is_default` (boolean, default account for sending)
      - `is_active` (boolean)
      - `created_at` / `updated_at` (timestamptz)

    - `email_templates`
      - `id` (uuid, primary key)
      - `name` (text, template name)
      - `subject` (text, email subject with placeholder support)
      - `body_html` (text, HTML body with placeholder support)
      - `body_text` (text, plain text fallback)
      - `category` (text, grouping: general, project, invoice, etc.)
      - `placeholders_used` (text[], list of placeholder keys used)
      - `is_active` (boolean)
      - `created_by` (uuid)
      - `created_at` / `updated_at` (timestamptz)

    - `email_log`
      - `id` (uuid, primary key)
      - `smtp_account_id` (uuid, which SMTP was used)
      - `template_id` (uuid, nullable, which template was used)
      - `sender_user_id` (uuid, who triggered the send)
      - `project_id` (uuid, nullable, associated project)
      - `from_email` (text)
      - `from_name` (text)
      - `to_emails` (text[], recipient list)
      - `cc_emails` (text[], CC list)
      - `bcc_emails` (text[], BCC list)
      - `subject` (text)
      - `body_html` (text)
      - `body_text` (text)
      - `status` (text: queued, sent, failed, bounced)
      - `error_message` (text, nullable)
      - `sent_at` (timestamptz, nullable)
      - `is_bulk` (boolean, part of bulk send)
      - `bulk_batch_id` (uuid, nullable, groups bulk emails)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Only admins can manage SMTP accounts
    - Only authenticated users can send/view emails
    - Users can only see emails they sent (admins see all)
*/

-- SMTP Accounts
CREATE TABLE IF NOT EXISTS smtp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587,
  username text NOT NULL DEFAULT '',
  password_encrypted text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  use_tls boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE smtp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SMTP accounts"
  ON smtp_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert SMTP accounts"
  ON smtp_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update SMTP accounts"
  ON smtp_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete SMTP accounts"
  ON smtp_accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  placeholders_used text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert email templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete email templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Email Log
CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_account_id uuid REFERENCES smtp_accounts(id),
  template_id uuid REFERENCES email_templates(id),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id),
  project_id uuid REFERENCES projects(id),
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  bcc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  sent_at timestamptz,
  is_bulk boolean NOT NULL DEFAULT false,
  bulk_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sent emails"
  ON email_log FOR SELECT
  TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can insert email log"
  ON email_log FOR INSERT
  TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

CREATE POLICY "Admins can update email log"
  ON email_log FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_log_sender ON email_log(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_project ON email_log(project_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_bulk_batch ON email_log(bulk_batch_id);
