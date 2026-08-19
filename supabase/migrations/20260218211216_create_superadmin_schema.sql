/*
  # Superadmin Portal Schema

  ## Overview
  Creates the schema needed for the superadmin portal — a platform-level control panel
  that operates above individual tenant organizations.

  ## New Tables

  ### superadmins
  - Stores which Supabase auth users have superadmin (platform-level) access
  - `user_id` - references auth.users
  - `created_at` - when they were granted superadmin access

  ### org_plans
  - Defines available subscription plans (free, pro, business, enterprise)
  - `name`, `slug`, `max_users`, `max_projects`, `max_storage_mb`
  - `price_monthly` - pricing for reference
  - `features` - JSONB array of included features

  ### system_announcements
  - Platform-level messages sent to all organizations or specific ones
  - `title`, `body` - the message content
  - `announcement_type` - info / warning / maintenance
  - `target_org_id` - NULL = all orgs, otherwise specific org
  - `is_active`, `expires_at` - display controls
  - `created_by` - the superadmin user who created it

  ## Security
  - RLS enabled on all tables
  - Only superadmin users can access these tables
  - Helper function `is_superadmin()` used in policies

  ## Notes
  - The organizations table already exists (from multitenancy migration)
  - We add `plan_id` and `notes` columns to organizations for plan tracking
*/

-- 1. Superadmins table
CREATE TABLE IF NOT EXISTS superadmins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;

-- Helper function to check superadmin status (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM superadmins WHERE user_id = auth.uid()
  );
$$;

CREATE POLICY "Superadmins can read superadmins table"
  ON superadmins FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmins can insert superadmins"
  ON superadmins FOR INSERT
  TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can delete superadmins"
  ON superadmins FOR DELETE
  TO authenticated
  USING (is_superadmin());

-- 2. Org plans table
CREATE TABLE IF NOT EXISTS org_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  max_users integer NOT NULL DEFAULT 5,
  max_projects integer NOT NULL DEFAULT 50,
  max_storage_mb integer NOT NULL DEFAULT 1024,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE org_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage org_plans"
  ON org_plans FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmins can insert org_plans"
  ON org_plans FOR INSERT
  TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can update org_plans"
  ON org_plans FOR UPDATE
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- 3. Add plan_id and notes to organizations (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN plan_id uuid REFERENCES org_plans(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'superadmin_notes'
  ) THEN
    ALTER TABLE organizations ADD COLUMN superadmin_notes text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE organizations ADD COLUMN is_suspended boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 4. System announcements
CREATE TABLE IF NOT EXISTS system_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  announcement_type text NOT NULL DEFAULT 'info' CHECK (announcement_type IN ('info', 'warning', 'maintenance', 'feature')),
  target_org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage announcements"
  ON system_announcements FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmins can insert announcements"
  ON system_announcements FOR INSERT
  TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can update announcements"
  ON system_announcements FOR UPDATE
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can delete announcements"
  ON system_announcements FOR DELETE
  TO authenticated
  USING (is_superadmin());

-- Allow authenticated users to read active announcements for their org
CREATE POLICY "Users can read active announcements for their org"
  ON system_announcements FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      target_org_id IS NULL
      OR target_org_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- 5. Seed default plans
INSERT INTO org_plans (name, slug, max_users, max_projects, max_storage_mb, price_monthly, features, sort_order)
VALUES
  ('Free', 'free', 3, 10, 512, 0, '["Základní funkce", "3 uživatelé", "10 projektů"]', 1),
  ('Pro', 'pro', 10, 100, 5120, 990, '["Vše z Free", "10 uživatelů", "100 projektů", "5 GB úložiště", "Emailové šablony", "Klientský portál"]', 2),
  ('Business', 'business', 50, 500, 20480, 2490, '["Vše z Pro", "50 uživatelů", "500 projektů", "20 GB úložiště", "Prioritní podpora", "API přístup"]', 3),
  ('Enterprise', 'enterprise', 999, 9999, 102400, 0, '["Neomezené vše", "Vlastní integrace", "SLA záruka", "Dedikovaný support"]', 4)
ON CONFLICT (slug) DO NOTHING;
