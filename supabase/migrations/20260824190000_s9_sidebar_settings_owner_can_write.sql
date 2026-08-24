/*
  # S9: sidebar_settings - zapis i pro vlastnika organizace

  ## Chyba
  Zapisove politiky z 20260220190316 vyzadovaly org roli PRESNE 'admin'.
  Vlastnik ('owner') tak nastaveni sidebaru nemohl ulozit - UPDATE pod RLS
  tise probehl na 0 radcich (bez chyby) a UI hlasilo "Ulozeno".

  ## Oprava
  Tri zapisove politiky se nahrazuji jednotnym pravidlem postavenym na
  helperech z S6/S7: radek patri organizaci uzivatele a uzivatel je
  plny admin (profiles.role='admin' NEBO org role owner/admin).
  Cteci politika (vsichni clenove org) zustava beze zmeny.
*/

DROP POLICY IF EXISTS "Admins can insert sidebar settings" ON sidebar_settings;
DROP POLICY IF EXISTS "Admins can update sidebar settings" ON sidebar_settings;
DROP POLICY IF EXISTS "Admins can delete sidebar settings" ON sidebar_settings;

CREATE POLICY "Org admins can insert sidebar settings"
  ON sidebar_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id() AND is_full_admin());

CREATE POLICY "Org admins can update sidebar settings"
  ON sidebar_settings FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND is_full_admin())
  WITH CHECK (organization_id = current_org_id() AND is_full_admin());

CREATE POLICY "Org admins can delete sidebar settings"
  ON sidebar_settings FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND is_full_admin());

-- Kontrola po nasazeni:
--   select policyname, cmd from pg_policies where tablename = 'sidebar_settings';
-- Ocekavani: 1x SELECT (puvodni cteci) + 3x nove Org admins politiky.
