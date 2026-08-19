/*
  # New Features Schema

  1. Modified Tables
    - `products` - Added `installation_hours` (numeric) for labor time estimates

  2. New Tables
    - `room_templates` - Predefined product sets per room type
    - `room_template_products` - Products in each template
    - `project_shares` - Shareable links for client portal

  3. Security
    - RLS enabled on all new tables
    - room_templates: readable by authenticated, writable by admins
    - project_shares: owners manage, public reads via token
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'installation_hours'
  ) THEN
    ALTER TABLE products ADD COLUMN installation_hours numeric DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS room_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  room_type text NOT NULL DEFAULT '',
  description text DEFAULT '',
  icon text DEFAULT 'home',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE room_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_templates' AND policyname = 'Authenticated users can view active room templates') THEN
    CREATE POLICY "Authenticated users can view active room templates" ON room_templates FOR SELECT TO authenticated USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_templates' AND policyname = 'Admins can insert room templates') THEN
    CREATE POLICY "Admins can insert room templates" ON room_templates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_templates' AND policyname = 'Admins can update room templates') THEN
    CREATE POLICY "Admins can update room templates" ON room_templates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_templates' AND policyname = 'Admins can delete room templates') THEN
    CREATE POLICY "Admins can delete room templates" ON room_templates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS room_template_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES room_templates(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1,
  note text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE room_template_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_template_products' AND policyname = 'Authenticated can view template products') THEN
    CREATE POLICY "Authenticated can view template products" ON room_template_products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM room_templates WHERE id = template_id AND is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_template_products' AND policyname = 'Admins can insert template products') THEN
    CREATE POLICY "Admins can insert template products" ON room_template_products FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_template_products' AND policyname = 'Admins can update template products') THEN
    CREATE POLICY "Admins can update template products" ON room_template_products FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_template_products' AND policyname = 'Admins can delete template products') THEN
    CREATE POLICY "Admins can delete template products" ON room_template_products FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  share_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  allow_comments boolean DEFAULT false,
  client_approved boolean DEFAULT false,
  client_approved_at timestamptz,
  client_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_shares' AND policyname = 'Project owners can view shares') THEN
    CREATE POLICY "Project owners can view shares" ON project_shares FOR SELECT TO authenticated USING (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_shares' AND policyname = 'Project owners can create shares') THEN
    CREATE POLICY "Project owners can create shares" ON project_shares FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_shares' AND policyname = 'Project owners can update shares') THEN
    CREATE POLICY "Project owners can update shares" ON project_shares FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_shares' AND policyname = 'Project owners can delete shares') THEN
    CREATE POLICY "Project owners can delete shares" ON project_shares FOR DELETE TO authenticated USING (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_shares' AND policyname = 'Anon can view active shares') THEN
    CREATE POLICY "Anon can view active shares" ON project_shares FOR SELECT TO anon USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_shares' AND policyname = 'Anon can approve shares') THEN
    CREATE POLICY "Anon can approve shares" ON project_shares FOR UPDATE TO anon USING (is_active = true AND (expires_at IS NULL OR expires_at > now())) WITH CHECK (is_active = true AND (expires_at IS NULL OR expires_at > now()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Public can read shared projects') THEN
    CREATE POLICY "Public can read shared projects" ON projects FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = projects.id AND project_shares.is_active = true AND (project_shares.expires_at IS NULL OR project_shares.expires_at > now())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_selections' AND policyname = 'Public can read shared project selections') THEN
    CREATE POLICY "Public can read shared project selections" ON project_selections FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = project_selections.project_id AND project_shares.is_active = true AND (project_shares.expires_at IS NULL OR project_shares.expires_at > now())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pin_placements' AND policyname = 'Public can read shared project placements') THEN
    CREATE POLICY "Public can read shared project placements" ON pin_placements FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = pin_placements.project_id AND project_shares.is_active = true AND (project_shares.expires_at IS NULL OR project_shares.expires_at > now())));
  END IF;
END $$;
