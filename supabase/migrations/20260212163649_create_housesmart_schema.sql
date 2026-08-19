/*
  # HouseSmart Catalog Schema

  1. New Tables
    - `profiles` - User profiles with roles (admin/viewer)
      - `id` (uuid, PK, references auth.users)
      - `email` (text)
      - `display_name` (text)
      - `role` (text, default 'viewer')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `categories` - Product categories
      - `id` (uuid, PK)
      - `name` (text) - display name
      - `slug` (text, unique) - URL-safe identifier
      - `icon` (text) - icon identifier
      - `pill_color` (text) - badge color class
      - `soft_color` (text) - soft background class
      - `text_color` (text) - text color class
      - `border_color` (text) - border color class
      - `sort_order` (integer)
      - `created_at`, `updated_at`

    - `products` - Catalog products
      - `id` (uuid, PK)
      - `category_id` (uuid, FK -> categories)
      - `name` (text)
      - `description` (text)
      - `code` (text) - pin prefix (TP, TT, ABB...)
      - `brand` (text)
      - `power` (text) - 24V, 230V, Tree/Air
      - `kind` (text) - normal or design_series
      - `tag` (text) - label like Standard, Design, etc.
      - `price` (numeric)
      - `image_url` (text)
      - `exclusive_group` (text) - for mutual exclusion
      - `is_active` (boolean)
      - `sort_order` (integer)
      - `created_at`, `updated_at`

    - `design_modules` - Insert types for design series
      - `id` (uuid, PK)
      - `name` (text)
      - `sort_order` (integer)

    - `design_presets` - Preset frame configurations
      - `id` (uuid, PK)
      - `name` (text)
      - `frame_size` (integer)
      - `modules` (jsonb) - array of module names
      - `sort_order` (integer)

    - `projects` - Saved user projects/standards
      - `id` (uuid, PK)
      - `user_id` (uuid, FK -> auth.users)
      - `name` (text)
      - `project_name` (text)
      - `client_name` (text)
      - `version_label` (text)
      - `floorplan_url` (text)
      - `created_at`, `updated_at`

    - `project_selections` - Products selected in a project
      - `id` (uuid, PK)
      - `project_id` (uuid, FK -> projects)
      - `product_id` (uuid, FK -> products)

    - `pin_placements` - Pins placed on floorplans
      - `id` (uuid, PK)
      - `project_id` (uuid, FK -> projects)
      - `product_id` (uuid, FK -> products)
      - `x` (numeric)
      - `y` (numeric)
      - `note` (text)
      - `design_config` (jsonb) - frame config for design series
      - `placed_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Profiles: users can read/update own profile
    - Categories/Products/Design modules/Presets: admins get full CRUD, everyone reads
    - Projects/Selections/Pins: users can CRUD their own data
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  slug text UNIQUE NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'layers',
  pill_color text NOT NULL DEFAULT 'bg-slate-800',
  soft_color text NOT NULL DEFAULT 'bg-slate-50',
  text_color text NOT NULL DEFAULT 'text-slate-900',
  border_color text NOT NULL DEFAULT 'border-slate-200',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  power text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'normal',
  tag text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  image_url text NOT NULL DEFAULT '',
  exclusive_group text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Design modules table
CREATE TABLE IF NOT EXISTS design_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE design_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read design modules"
  ON design_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert design modules"
  ON design_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update design modules"
  ON design_modules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete design modules"
  ON design_modules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Design presets table
CREATE TABLE IF NOT EXISTS design_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  frame_size integer NOT NULL DEFAULT 1,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE design_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read design presets"
  ON design_presets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert design presets"
  ON design_presets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update design presets"
  ON design_presets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete design presets"
  ON design_presets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  version_label text NOT NULL DEFAULT '',
  floorplan_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Project selections table
CREATE TABLE IF NOT EXISTS project_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own project selections"
  ON project_selections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = project_selections.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project selections"
  ON project_selections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = project_selections.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project selections"
  ON project_selections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = project_selections.project_id AND projects.user_id = auth.uid()
    )
  );

-- Pin placements table
CREATE TABLE IF NOT EXISTS pin_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  design_config jsonb,
  placed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pin_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pin placements"
  ON pin_placements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = pin_placements.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own pin placements"
  ON pin_placements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = pin_placements.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own pin placements"
  ON pin_placements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = pin_placements.project_id AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = pin_placements.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own pin placements"
  ON pin_placements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = pin_placements.project_id AND projects.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_selections_project ON project_selections(project_id);
CREATE INDEX IF NOT EXISTS idx_pin_placements_project ON pin_placements(project_id);
CREATE INDEX IF NOT EXISTS idx_pin_placements_product ON pin_placements(product_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN 'admin'
      ELSE 'viewer'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
