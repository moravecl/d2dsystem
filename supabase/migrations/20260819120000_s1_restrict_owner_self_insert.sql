/*
  # S1: Zablokování převzetí cizí organizace

  ## Problém (kritický)
  Politika "Users can insert themselves as owner" na organization_members
  nijak neomezovala organization_id. Libovolný přihlášený uživatel mohl provést
  INSERT (organization_id = <cizí firma>, user_id = já, role = 'owner')
  a stát se ownerem cizí organizace — plný přístup k jejím datům.

  ## Oprava
  Self-insert ownera je povolen POUZE do organizace, kterou uživatel sám
  vytvořil (organizations.owner_id = auth.uid()). Vytvoření organizace už je
  chráněno politikou "Authenticated users can create organizations"
  (WITH CHECK owner_id = auth.uid()) a owner_id smí měnit jen owner sám.

  Onboarding flow (OnboardingPage) zůstává funkční beze změn:
  1. INSERT organizations (owner_id = já) → projde
  2. INSERT organization_members (moje nová org, role owner) → projde přes novou politiku

  Helper je SECURITY DEFINER, aby kontrola vlastnictví nenarazila na RLS
  organizations (nová org ještě nemá členy, takže SELECT politika členství
  by ji neviděla).
*/

-- Helper: je přihlášený uživatel zakladatelem (owner_id) dané organizace?
CREATE OR REPLACE FUNCTION is_org_creator(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = org_id AND owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION is_org_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_org_creator(uuid) TO authenticated;

-- Odstranit děravou politiku
DROP POLICY IF EXISTS "Users can insert themselves as owner" ON organization_members;

-- Nahradit bezpečnou variantou
CREATE POLICY "Org creators can insert themselves as owner"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND is_org_creator(organization_id)
  );
