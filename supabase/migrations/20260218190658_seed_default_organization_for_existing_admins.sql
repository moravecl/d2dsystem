/*
  # Seed Default Organization for Existing Admin Users

  ## Problem
  All existing profiles have `organization_id = null`, which causes the app to
  redirect every user to the /onboarding page even though they were using the
  system before multi-tenancy was introduced.

  ## Changes
  1. Creates a default "HouseSmart" organization owned by the first admin user
  2. Links all existing admin/manager profiles to that organization
  3. Inserts organization_members rows for each of those users
  4. Does NOT touch portal client profiles (is_portal_client = true)
*/

DO $$
DECLARE
  v_org_id uuid := gen_random_uuid();
  v_owner_id uuid;
BEGIN
  -- Pick the first admin user as the owner
  SELECT id INTO v_owner_id
  FROM profiles
  WHERE role = 'admin' AND (is_portal_client IS NULL OR is_portal_client = false)
  ORDER BY id
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No admin user found, skipping default org creation';
    RETURN;
  END IF;

  -- Create the default organization
  INSERT INTO organizations (id, name, slug, owner_id, subscription_tier, max_users, is_active)
  VALUES (v_org_id, 'HouseSmart', 'housesmart', v_owner_id, 'business', 9999, true)
  ON CONFLICT (slug) DO NOTHING;

  -- If org already existed (conflict), fetch its id
  IF NOT FOUND THEN
    SELECT id INTO v_org_id FROM organizations WHERE slug = 'housesmart';
  END IF;

  -- Link all non-portal profiles to the organization
  UPDATE profiles
  SET organization_id = v_org_id
  WHERE (is_portal_client IS NULL OR is_portal_client = false)
    AND organization_id IS NULL;

  -- Insert organization_members for every linked profile (owner for first admin, admin for others)
  INSERT INTO organization_members (organization_id, user_id, role, joined_at)
  SELECT
    v_org_id,
    p.id,
    CASE WHEN p.id = v_owner_id THEN 'owner' ELSE 'admin' END,
    now()
  FROM profiles p
  WHERE p.organization_id = v_org_id
    AND (p.is_portal_client IS NULL OR p.is_portal_client = false)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

END $$;
