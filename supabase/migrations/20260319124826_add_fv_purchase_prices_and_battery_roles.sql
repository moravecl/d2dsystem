/*
  # Add purchase prices to FV catalog and battery role fields

  1. Changes to fv_batteries
    - `battery_role` (text): master | slave | bms | standalone
    - `compatibility_group` (text): grouping for master/slave compatibility
    - `max_slave_units` (integer): max slave units for master batteries
    - `purchase_price` (numeric): cost price

  2. Purchase price fields added to:
    - fv_panels: purchase_price
    - fv_inverters: purchase_price
    - fv_batteries: purchase_price
    - fv_wallboxes: purchase_price
    - fv_accessories: purchase_price_per_unit
    - fv_hooks: purchase_price
    - fv_rail_profiles: purchase_price_per_m
    - fv_clamps: purchase_price

  3. Labor rates
    - fv_labor_rates: purchase_price_per_unit (cost rate for labor)

  These fields enable accurate profit/margin calculations in quotes.
*/

DO $$
BEGIN
  -- fv_batteries: battery role fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_batteries' AND column_name = 'battery_role'
  ) THEN
    ALTER TABLE fv_batteries ADD COLUMN battery_role text DEFAULT 'standalone';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_batteries' AND column_name = 'compatibility_group'
  ) THEN
    ALTER TABLE fv_batteries ADD COLUMN compatibility_group text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_batteries' AND column_name = 'max_slave_units'
  ) THEN
    ALTER TABLE fv_batteries ADD COLUMN max_slave_units integer DEFAULT 0;
  END IF;

  -- fv_panels: purchase_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_panels' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE fv_panels ADD COLUMN purchase_price numeric DEFAULT 0;
  END IF;

  -- fv_inverters: purchase_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_inverters' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE fv_inverters ADD COLUMN purchase_price numeric DEFAULT 0;
  END IF;

  -- fv_batteries: purchase_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_batteries' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE fv_batteries ADD COLUMN purchase_price numeric DEFAULT 0;
  END IF;

  -- fv_wallboxes: purchase_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_wallboxes' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE fv_wallboxes ADD COLUMN purchase_price numeric DEFAULT 0;
  END IF;

  -- fv_accessories: purchase_price_per_unit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_accessories' AND column_name = 'purchase_price_per_unit'
  ) THEN
    ALTER TABLE fv_accessories ADD COLUMN purchase_price_per_unit numeric DEFAULT 0;
  END IF;

  -- fv_hooks: purchase_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_hooks' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE fv_hooks ADD COLUMN purchase_price numeric DEFAULT 0;
  END IF;

  -- fv_rail_profiles: purchase_price_per_m
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_rail_profiles' AND column_name = 'purchase_price_per_m'
  ) THEN
    ALTER TABLE fv_rail_profiles ADD COLUMN purchase_price_per_m numeric DEFAULT 0;
  END IF;

  -- fv_clamps: purchase_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_clamps' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE fv_clamps ADD COLUMN purchase_price numeric DEFAULT 0;
  END IF;

  -- fv_labor_rates: purchase_price_per_unit (cost rate)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fv_labor_rates' AND column_name = 'purchase_price_per_unit'
  ) THEN
    ALTER TABLE fv_labor_rates ADD COLUMN purchase_price_per_unit numeric DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN fv_batteries.battery_role IS 'Battery role: master, slave, bms, or standalone';
COMMENT ON COLUMN fv_batteries.compatibility_group IS 'Group name for master/slave compatibility matching';
COMMENT ON COLUMN fv_batteries.max_slave_units IS 'Maximum number of slave units this master can support';
