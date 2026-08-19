/*
  # Create materials table for admin-managed pipe/cable types and prices

  1. New Tables
    - `materials`
      - `id` (uuid, primary key)
      - `name` (text) - e.g. "CYKY-J 3x1,5", "PPR 20x3,4"
      - `trade` (text) - one of: electric, water, heating, recuperation
      - `unit` (text) - measurement unit, default 'm'
      - `price_per_unit` (numeric) - price per unit in CZK
      - `sort_order` (integer)
      - `is_active` (boolean)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `materials` table
    - Admins can do full CRUD
    - Authenticated users can read active materials
    - Public (anon) can read active materials for the catalog

  3. Seed data
    - Pre-populate with common Czech electrical cables, water pipes, heating pipes, and recuperation ducts
*/

CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade text NOT NULL DEFAULT 'electric'
    CHECK (trade IN ('electric', 'water', 'heating', 'recuperation')),
  unit text NOT NULL DEFAULT 'm',
  price_per_unit numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage materials"
  ON materials FOR ALL
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

CREATE POLICY "Anyone can read active materials"
  ON materials FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Seed: Elektro
INSERT INTO materials (name, trade, unit, sort_order) VALUES
  ('CYKY-J 3x1,5', 'electric', 'm', 1),
  ('CYKY-J 3x2,5', 'electric', 'm', 2),
  ('CYKY-J 5x1,5', 'electric', 'm', 3),
  ('CYKY-J 5x2,5', 'electric', 'm', 4),
  ('CYKY-O 3x1,5', 'electric', 'm', 5),
  ('CYKY-O 3x2,5', 'electric', 'm', 6),
  ('J-Y(St)Y 2x2x0,8', 'electric', 'm', 7),
  ('UTP Cat5e', 'electric', 'm', 8),
  ('UTP Cat6', 'electric', 'm', 9),
  ('SYKFY 5x2x0,5', 'electric', 'm', 10),
  ('1-CXKE-V 1x2x0,8', 'electric', 'm', 11),
  ('JYTY 2x1', 'electric', 'm', 12);

-- Seed: Voda
INSERT INTO materials (name, trade, unit, sort_order) VALUES
  ('PPR 20x3,4', 'water', 'm', 1),
  ('PPR 25x4,2', 'water', 'm', 2),
  ('PPR 32x5,4', 'water', 'm', 3),
  ('PEX 16x2', 'water', 'm', 4),
  ('PEX 20x2', 'water', 'm', 5),
  ('Cu 15x1', 'water', 'm', 6),
  ('Cu 18x1', 'water', 'm', 7),
  ('Cu 22x1', 'water', 'm', 8),
  ('Alupl. 16x2', 'water', 'm', 9),
  ('Alupl. 20x2', 'water', 'm', 10);

-- Seed: Topení
INSERT INTO materials (name, trade, unit, sort_order) VALUES
  ('PPR 20x3,4', 'heating', 'm', 1),
  ('PPR 25x4,2', 'heating', 'm', 2),
  ('PEX 16x2', 'heating', 'm', 3),
  ('PEX 20x2', 'heating', 'm', 4),
  ('Pe-Xa 17x2', 'heating', 'm', 5),
  ('Cu 15x1', 'heating', 'm', 6),
  ('Cu 18x1', 'heating', 'm', 7),
  ('Cu 22x1', 'heating', 'm', 8);

-- Seed: Rekuperace
INSERT INTO materials (name, trade, unit, sort_order) VALUES
  ('Flexi potrubí 75 mm', 'recuperation', 'm', 1),
  ('Flexi potrubí 90 mm', 'recuperation', 'm', 2),
  ('Flexi potrubí 125 mm', 'recuperation', 'm', 3),
  ('Spiro potrubí 100 mm', 'recuperation', 'm', 4),
  ('Spiro potrubí 125 mm', 'recuperation', 'm', 5),
  ('Spiro potrubí 160 mm', 'recuperation', 'm', 6),
  ('Spiro potrubí 200 mm', 'recuperation', 'm', 7),
  ('Plochý kanál 60x200', 'recuperation', 'm', 8),
  ('Plochý kanál 60x120', 'recuperation', 'm', 9);
