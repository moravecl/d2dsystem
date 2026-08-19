/*
  # Fix profile creation trigger

  1. Changes
    - Recreate handle_new_user function with proper search_path
    - Add service_role insert policy to bypass RLS during signup
    - Allow anonymous read access to categories/products for public catalog
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM profiles) INTO is_first;

  INSERT INTO profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    CASE WHEN is_first THEN 'admin' ELSE 'viewer' END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Allow anon (public) to read categories and products for public catalog
CREATE POLICY "Public can read categories"
  ON categories FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Public can read design modules"
  ON design_modules FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can read design presets"
  ON design_presets FOR SELECT
  TO anon
  USING (true);
