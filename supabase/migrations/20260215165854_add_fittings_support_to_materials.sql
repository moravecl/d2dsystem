/*
  # Add fittings (tvarovky) support to materials

  1. Modified Tables
    - `materials`
      - `material_type` (text, default 'linear') - Type classification:
        'linear' for cables/pipes measured per meter,
        'fitting' for fittings measured per piece,
        'other' for miscellaneous items
      - `fitting_calc_rule` (text, nullable) - Auto-calculation rule from design:
        'per_bend' = one per cable/pipe bend,
        'per_tee' = one per T-junction,
        'per_endpoint' = one per cable/pipe endpoint,
        'per_10m' = one per every 10 meters of cable/pipe
      - `purchase_price` (numeric, default 0) - Purchase price for profit tracking

  2. Seed Data
    - Common fittings for each trade (electric, water, heating, recuperation)
    - Each fitting has an appropriate calc rule for auto-calculation from design

  3. Notes
    - All existing materials default to 'linear' type (no data change)
    - Fittings quantities are auto-calculated from cable/pipe routing in the design
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'material_type'
  ) THEN
    ALTER TABLE materials ADD COLUMN material_type text NOT NULL DEFAULT 'linear';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'fitting_calc_rule'
  ) THEN
    ALTER TABLE materials ADD COLUMN fitting_calc_rule text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE materials ADD COLUMN purchase_price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Seed: Electric fittings
INSERT INTO materials (name, trade, unit, material_type, fitting_calc_rule, sort_order) VALUES
  ('Krabice odbocna KO 97', 'electric', 'ks', 'fitting', 'per_tee', 100),
  ('Krabice pristroj. KP 67', 'electric', 'ks', 'fitting', 'per_endpoint', 101),
  ('Chranicka ohybna 20mm', 'electric', 'ks', 'fitting', 'per_bend', 102),
  ('Svorkovnice Wago 3x', 'electric', 'ks', 'fitting', 'per_tee', 103),
  ('Kabelova pruvlecka PG16', 'electric', 'ks', 'fitting', 'per_endpoint', 104),
  ('Fixacni prvek 10m', 'electric', 'ks', 'fitting', 'per_10m', 105);

-- Seed: Water fittings
INSERT INTO materials (name, trade, unit, material_type, fitting_calc_rule, sort_order) VALUES
  ('PPR koleno 90° 20mm', 'water', 'ks', 'fitting', 'per_bend', 100),
  ('PPR koleno 90° 25mm', 'water', 'ks', 'fitting', 'per_bend', 101),
  ('PPR T-kus 20mm', 'water', 'ks', 'fitting', 'per_tee', 102),
  ('PPR T-kus 25mm', 'water', 'ks', 'fitting', 'per_tee', 103),
  ('PPR zaslepka 20mm', 'water', 'ks', 'fitting', 'per_endpoint', 104),
  ('PPR objimka 20mm', 'water', 'ks', 'fitting', 'per_10m', 105);

-- Seed: Heating fittings
INSERT INTO materials (name, trade, unit, material_type, fitting_calc_rule, sort_order) VALUES
  ('PEX koleno fixacni 16mm', 'heating', 'ks', 'fitting', 'per_bend', 100),
  ('PEX koleno fixacni 20mm', 'heating', 'ks', 'fitting', 'per_bend', 101),
  ('PEX T-kus 16mm', 'heating', 'ks', 'fitting', 'per_tee', 102),
  ('PEX T-kus 20mm', 'heating', 'ks', 'fitting', 'per_tee', 103),
  ('PEX lisovaci spojka 16mm', 'heating', 'ks', 'fitting', 'per_endpoint', 104),
  ('PEX objimka 16mm', 'heating', 'ks', 'fitting', 'per_10m', 105);

-- Seed: Recuperation fittings
INSERT INTO materials (name, trade, unit, material_type, fitting_calc_rule, sort_order) VALUES
  ('Koleno 90° 125mm', 'recuperation', 'ks', 'fitting', 'per_bend', 100),
  ('T-kus 125mm', 'recuperation', 'ks', 'fitting', 'per_tee', 101),
  ('Redukce 160/125mm', 'recuperation', 'ks', 'fitting', 'per_endpoint', 102),
  ('Objimka 125mm', 'recuperation', 'ks', 'fitting', 'per_10m', 103),
  ('Koleno 90° 160mm', 'recuperation', 'ks', 'fitting', 'per_bend', 104),
  ('T-kus 160mm', 'recuperation', 'ks', 'fitting', 'per_tee', 105);
