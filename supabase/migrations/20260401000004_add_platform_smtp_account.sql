/*
  # Add platform SMTP account support

  ## Problem
  Transactional emails (team invites, password reset confirmations, welcome emails)
  are sent via the org's own SMTP account. If an org has no SMTP configured,
  these emails silently fail.

  Supabase Auth handles /register and /reset-password emails natively via
  Supabase project SMTP settings — those are NOT affected by this migration.

  ## Solution
  1. Add is_platform_default boolean to smtp_accounts
     - When true, this account belongs to the platform (owner = superadmin)
     - organization_id is NULL for platform accounts
  2. Update RLS so superadmins can INSERT/UPDATE/DELETE platform SMTP accounts
  3. Allow any org user to SELECT platform SMTP accounts (needed to send transactional
     emails when the org has no own SMTP)
  4. The app's getDefaultSmtp() will be updated to fall back to the platform SMTP
*/

-- ============================================================
-- 1. Add is_platform_default column
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smtp_accounts' AND column_name = 'is_platform_default'
  ) THEN
    ALTER TABLE smtp_accounts ADD COLUMN is_platform_default boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_smtp_accounts_platform ON smtp_accounts(is_platform_default) WHERE is_platform_default = true;

-- ============================================================
-- 2. Update RLS policies
-- ============================================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Org admins can view smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Org admins can insert smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Org admins can update smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Org admins can delete smtp accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Authenticated users can view SMTP accounts" ON smtp_accounts;
DROP POLICY IF EXISTS "Superadmins can manage platform smtp" ON smtp_accounts;
DROP POLICY IF EXISTS "Superadmins can view platform smtp" ON smtp_accounts;

-- Org members see their own org's SMTP accounts
CREATE POLICY "Org admins can view smtp accounts"
  ON smtp_accounts FOR SELECT TO authenticated
  USING (
    organization_id = get_my_organization_id()
    OR organization_id IS NULL  -- platform accounts visible to all for fallback
  );

CREATE POLICY "Org admins can insert smtp accounts"
  ON smtp_accounts FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_my_organization_id()
    AND is_platform_default = false
  );

CREATE POLICY "Org admins can update smtp accounts"
  ON smtp_accounts FOR UPDATE TO authenticated
  USING (
    organization_id = get_my_organization_id()
    AND is_platform_default = false
  )
  WITH CHECK (
    organization_id = get_my_organization_id()
    AND is_platform_default = false
  );

CREATE POLICY "Org admins can delete smtp accounts"
  ON smtp_accounts FOR DELETE TO authenticated
  USING (
    organization_id = get_my_organization_id()
    AND is_platform_default = false
  );

-- Superadmins can manage platform SMTP accounts (organization_id IS NULL)
CREATE POLICY "Superadmins can insert platform smtp"
  ON smtp_accounts FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_default = true
    AND organization_id IS NULL
    AND EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
  );

CREATE POLICY "Superadmins can update platform smtp"
  ON smtp_accounts FOR UPDATE TO authenticated
  USING (
    is_platform_default = true
    AND EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    is_platform_default = true
    AND EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
  );

CREATE POLICY "Superadmins can delete platform smtp"
  ON smtp_accounts FOR DELETE TO authenticated
  USING (
    is_platform_default = true
    AND EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
  );
