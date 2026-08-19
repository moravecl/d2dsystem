/*
  # Add lighting fields and norms table

  1. Changes to `products` table
    - `lumens` (integer, default 0) - light output in lumens for lighting products

  2. New Tables
    - `lighting_norms`
      - `id` (uuid, primary key)
      - `room_type` (text) - type of room (e.g. 'Obyvaci pokoj', 'Kuchyne')
      - `required_lux` (integer) - required lux level per CSN EN 12464-1
      - `description` (text) - description of the norm
      - `sort_order` (integer)
      - `is_active` (boolean)

  3. Security
    - Enable RLS on `lighting_norms` table
    - Policy for authenticated users to read norms
    - Policy for admin users to manage norms

  4. Seed data
    - Czech residential lighting standards based on CSN EN 12464-1
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'lumens'
  ) THEN
    ALTER TABLE products ADD COLUMN lumens integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lighting_norms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type text NOT NULL,
  required_lux integer NOT NULL DEFAULT 150,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lighting_norms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read lighting norms'
  ) THEN
    CREATE POLICY "Authenticated users can read lighting norms"
      ON lighting_norms FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage lighting norms'
  ) THEN
    CREATE POLICY "Admins can manage lighting norms"
      ON lighting_norms FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

INSERT INTO lighting_norms (room_type, required_lux, description, sort_order) VALUES
  ('Obyvaci pokoj', 200, 'Obyvaci a relaxacni zona', 1),
  ('Kuchyne', 500, 'Pracovni plochy kuchyne', 2),
  ('Loznice', 150, 'Klidova zona, cteni', 3),
  ('Detsky pokoj', 300, 'Herni a studijni prostor', 4),
  ('Koupelna', 300, 'Hygiena, zrcadlo', 5),
  ('WC', 150, 'Zakladni osvetleni', 6),
  ('Pracovna', 500, 'Pracovni stul, monitor', 7),
  ('Chodba', 100, 'Komunikacni prostor', 8),
  ('Predsien', 150, 'Vstupni prostor', 9),
  ('Jidelna', 200, 'Jidelni stul', 10),
  ('Satna', 200, 'Satna, sachty', 11),
  ('Technicka mistnost', 200, 'Kotelna, utility', 12),
  ('Garaz', 100, 'Parkovani, dilna', 13),
  ('Sklad', 100, 'Ulozne prostory', 14),
  ('Terasa', 50, 'Venkovni kryty prostor', 15)
ON CONFLICT DO NOTHING;