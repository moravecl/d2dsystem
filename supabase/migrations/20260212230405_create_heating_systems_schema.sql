/*
  # Create Heating Systems Schema

  This migration creates a comprehensive heating system configuration framework
  for managing different types of floor heating and radiator systems.

  1. New Tables
    - `heating_systems` - Main system types (wet underfloor, dry underfloor, electric mats, radiators)
      - `id` (uuid, primary key)
      - `name` (text) - Display name
      - `slug` (text, unique) - URL/code-safe identifier
      - `description` (text) - System description
      - `sort_order` (int) - Display ordering
      - `is_active` (boolean) - Whether available for selection

    - `heating_system_options` - Configurable parameters per system
      - `id` (uuid, primary key)
      - `heating_system_id` (uuid, FK) - Parent system
      - `name` (text) - Option display name
      - `slug` (text) - Machine-safe identifier
      - `field_type` (text) - UI control type: 'select', 'number', 'boolean'
      - `options` (jsonb) - Choices for select fields [{value, label}]
      - `default_value` (text) - Initial value
      - `unit` (text) - Unit label (cm, mm, etc.)
      - `description` (text) - Help text
      - `sort_order` (int)

    - `heating_system_materials` - Material rules with conditional quantities
      - `id` (uuid, primary key)
      - `heating_system_id` (uuid, FK) - Parent system
      - `name` (text) - Material name
      - `unit` (text) - Measurement unit
      - `price_per_unit` (numeric) - Price per unit
      - `quantity_per_m2` (numeric) - Amount needed per m2 of room area
      - `quantity_per_m_perimeter` (numeric) - Amount needed per meter of room perimeter
      - `quantity_fixed` (numeric) - Fixed amount per room
      - `condition_option_slug` (text) - Only include if this option matches
      - `condition_option_value` (text) - Required value for condition
      - `waste_percent` (numeric) - Material waste percentage
      - `sort_order` (int)
      - `is_active` (boolean)

  2. Security
    - Enable RLS on all tables
    - Authenticated users can read active systems, options, and materials
    - Admin users can perform all CRUD operations
*/

-- heating_systems
CREATE TABLE IF NOT EXISTS heating_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE heating_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active heating systems"
  ON heating_systems FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can read all heating systems"
  ON heating_systems FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert heating systems"
  ON heating_systems FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update heating systems"
  ON heating_systems FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete heating systems"
  ON heating_systems FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- heating_system_options
CREATE TABLE IF NOT EXISTS heating_system_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heating_system_id uuid NOT NULL REFERENCES heating_systems(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  field_type text NOT NULL DEFAULT 'select',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_value text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(heating_system_id, slug)
);

ALTER TABLE heating_system_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read heating system options"
  ON heating_system_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM heating_systems
      WHERE heating_systems.id = heating_system_options.heating_system_id
    )
  );

CREATE POLICY "Admins can insert heating system options"
  ON heating_system_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update heating system options"
  ON heating_system_options FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete heating system options"
  ON heating_system_options FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- heating_system_materials
CREATE TABLE IF NOT EXISTS heating_system_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heating_system_id uuid NOT NULL REFERENCES heating_systems(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'm',
  price_per_unit numeric NOT NULL DEFAULT 0,
  quantity_per_m2 numeric NOT NULL DEFAULT 0,
  quantity_per_m_perimeter numeric NOT NULL DEFAULT 0,
  quantity_fixed numeric NOT NULL DEFAULT 0,
  condition_option_slug text NOT NULL DEFAULT '',
  condition_option_value text NOT NULL DEFAULT '',
  waste_percent numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE heating_system_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read heating system materials"
  ON heating_system_materials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM heating_systems
      WHERE heating_systems.id = heating_system_materials.heating_system_id
    )
  );

CREATE POLICY "Admins can insert heating system materials"
  ON heating_system_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update heating system materials"
  ON heating_system_materials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete heating system materials"
  ON heating_system_materials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
