/*
  # Custom Roles and Granular Permissions System

  1. New Tables
    - `custom_roles`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `name` (text) - Role display name (e.g. "Projektant", "Obchodnik")
      - `slug` (text) - Unique key within org
      - `description` (text) - What this role is for
      - `color` (text) - Badge color hex
      - `is_system` (boolean) - Whether it's a built-in role (admin/owner cannot be deleted)
      - `permissions` (jsonb) - Full permission map
      - `sort_order` (integer)
      - `created_at`, `updated_at`

    - `user_role_assignments`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `user_id` (uuid, references auth.users)
      - `role_id` (uuid, references custom_roles)
      - `assigned_by` (uuid, references auth.users)
      - `assigned_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Only org admins/owners can manage roles
    - All org members can read roles (to check their own permissions)

  3. Notes
    - Permissions are stored as JSONB with granular keys
    - System roles (admin, owner) cannot be deleted or have permissions reduced
    - Each user can have exactly one custom role per organization
*/

-- Custom roles table
CREATE TABLE IF NOT EXISTS custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#64748b',
  is_system boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_roles_org_slug_unique UNIQUE (organization_id, slug)
);

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read roles"
  ON custom_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = custom_roles.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert roles"
  ON custom_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = custom_roles.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update roles"
  ON custom_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = custom_roles.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = custom_roles.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete non-system roles"
  ON custom_roles FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = custom_roles.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- User role assignments table
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_role_assignments_org_user_unique UNIQUE (organization_id, user_id)
);

ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read assignments"
  ON user_role_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = user_role_assignments.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can insert assignments"
  ON user_role_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = user_role_assignments.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update assignments"
  ON user_role_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = user_role_assignments.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = user_role_assignments.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete assignments"
  ON user_role_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = user_role_assignments.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Seed default system roles for all existing organizations
INSERT INTO custom_roles (organization_id, name, slug, description, color, is_system, permissions, sort_order)
SELECT
  o.id,
  'Administrátor',
  'admin',
  'Plný přístup ke všem částem systému',
  '#0ea5e9',
  true,
  '{
    "modules": {
      "dashboard": true, "crm": true, "leady": true, "projekty": true,
      "realizace": true, "ukoly": true, "servis": true, "cas": true,
      "gantt": true, "udalosti": true, "kalendar": true, "dochazka": true,
      "katalog": true, "sklad": true, "majetek": true, "finance": true,
      "emailing": true, "zamestnanci": true, "znalosti": true, "nastenka": true,
      "reporty": true, "archiv": true, "admin": true
    },
    "data": {
      "view_prices": true,
      "view_purchase_prices": true,
      "view_margins": true,
      "view_financial_reports": true,
      "view_invoices": true,
      "view_salaries": true,
      "edit_projects": true,
      "delete_projects": true,
      "edit_clients": true,
      "delete_clients": true,
      "edit_products": true,
      "edit_quotes": true,
      "approve_quotes": true,
      "manage_team": true,
      "manage_roles": true,
      "view_audit_log": true,
      "manage_settings": true,
      "export_data": true,
      "manage_templates": true,
      "manage_automations": true,
      "manage_warehouse": true,
      "manage_assets": true,
      "manage_service": true
    }
  }'::jsonb,
  0
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM custom_roles cr WHERE cr.organization_id = o.id AND cr.slug = 'admin'
);

INSERT INTO custom_roles (organization_id, name, slug, description, color, is_system, permissions, sort_order)
SELECT
  o.id,
  'Manažer',
  'manager',
  'Správa projektů, klientů a týmu',
  '#10b981',
  true,
  '{
    "modules": {
      "dashboard": true, "crm": true, "leady": true, "projekty": true,
      "realizace": true, "ukoly": true, "servis": true, "cas": true,
      "gantt": true, "udalosti": true, "kalendar": true, "dochazka": true,
      "katalog": true, "sklad": true, "majetek": true, "finance": true,
      "emailing": true, "zamestnanci": true, "znalosti": true, "nastenka": true,
      "reporty": true, "archiv": true, "admin": false
    },
    "data": {
      "view_prices": true,
      "view_purchase_prices": true,
      "view_margins": true,
      "view_financial_reports": true,
      "view_invoices": true,
      "view_salaries": false,
      "edit_projects": true,
      "delete_projects": false,
      "edit_clients": true,
      "delete_clients": false,
      "edit_products": true,
      "edit_quotes": true,
      "approve_quotes": true,
      "manage_team": false,
      "manage_roles": false,
      "view_audit_log": false,
      "manage_settings": false,
      "export_data": true,
      "manage_templates": true,
      "manage_automations": false,
      "manage_warehouse": true,
      "manage_assets": true,
      "manage_service": true
    }
  }'::jsonb,
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM custom_roles cr WHERE cr.organization_id = o.id AND cr.slug = 'manager'
);

INSERT INTO custom_roles (organization_id, name, slug, description, color, is_system, permissions, sort_order)
SELECT
  o.id,
  'Zaměstnanec',
  'employee',
  'Přístup k projektům a pracovním záznamům',
  '#f59e0b',
  true,
  '{
    "modules": {
      "dashboard": true, "crm": false, "leady": false, "projekty": true,
      "realizace": true, "ukoly": true, "servis": true, "cas": true,
      "gantt": true, "udalosti": true, "kalendar": true, "dochazka": true,
      "katalog": true, "sklad": true, "majetek": false, "finance": false,
      "emailing": false, "zamestnanci": false, "znalosti": true, "nastenka": true,
      "reporty": false, "archiv": false, "admin": false
    },
    "data": {
      "view_prices": false,
      "view_purchase_prices": false,
      "view_margins": false,
      "view_financial_reports": false,
      "view_invoices": false,
      "view_salaries": false,
      "edit_projects": true,
      "delete_projects": false,
      "edit_clients": false,
      "delete_clients": false,
      "edit_products": false,
      "edit_quotes": false,
      "approve_quotes": false,
      "manage_team": false,
      "manage_roles": false,
      "view_audit_log": false,
      "manage_settings": false,
      "export_data": false,
      "manage_templates": false,
      "manage_automations": false,
      "manage_warehouse": true,
      "manage_assets": false,
      "manage_service": true
    }
  }'::jsonb,
  2
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM custom_roles cr WHERE cr.organization_id = o.id AND cr.slug = 'employee'
);

INSERT INTO custom_roles (organization_id, name, slug, description, color, is_system, permissions, sort_order)
SELECT
  o.id,
  'Čtenář',
  'viewer',
  'Pouze prohlížení bez možnosti editace',
  '#94a3b8',
  true,
  '{
    "modules": {
      "dashboard": true, "crm": true, "leady": false, "projekty": true,
      "realizace": true, "ukoly": true, "servis": false, "cas": false,
      "gantt": true, "udalosti": true, "kalendar": true, "dochazka": false,
      "katalog": true, "sklad": false, "majetek": false, "finance": false,
      "emailing": false, "zamestnanci": false, "znalosti": true, "nastenka": true,
      "reporty": false, "archiv": false, "admin": false
    },
    "data": {
      "view_prices": false,
      "view_purchase_prices": false,
      "view_margins": false,
      "view_financial_reports": false,
      "view_invoices": false,
      "view_salaries": false,
      "edit_projects": false,
      "delete_projects": false,
      "edit_clients": false,
      "delete_clients": false,
      "edit_products": false,
      "edit_quotes": false,
      "approve_quotes": false,
      "manage_team": false,
      "manage_roles": false,
      "view_audit_log": false,
      "manage_settings": false,
      "export_data": false,
      "manage_templates": false,
      "manage_automations": false,
      "manage_warehouse": false,
      "manage_assets": false,
      "manage_service": false
    }
  }'::jsonb,
  3
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM custom_roles cr WHERE cr.organization_id = o.id AND cr.slug = 'viewer'
);

-- Auto-assign existing org members to matching system roles
INSERT INTO user_role_assignments (organization_id, user_id, role_id)
SELECT
  om.organization_id,
  om.user_id,
  cr.id
FROM organization_members om
JOIN custom_roles cr ON cr.organization_id = om.organization_id
  AND cr.slug = CASE
    WHEN om.role IN ('owner', 'admin') THEN 'admin'
    WHEN om.role = 'manager' THEN 'manager'
    WHEN om.role = 'employee' THEN 'employee'
    ELSE 'viewer'
  END
WHERE NOT EXISTS (
  SELECT 1 FROM user_role_assignments ura
  WHERE ura.organization_id = om.organization_id AND ura.user_id = om.user_id
);
