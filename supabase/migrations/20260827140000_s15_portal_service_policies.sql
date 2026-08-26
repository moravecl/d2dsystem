/*
  # S15: Servisni modul v portalu - oprava politik po S7

  Ctyri politiky z 20260217211526 overovaly klienta vnorenym dotazem
  pres projects JOIN clients. Vnoreny dotaz podleha RLS a `clients` je
  po S7 org-scoped, takze portalovy klient svuj zaznam neprecte a
  podminka selze (v portalu se nezobrazuji instalovana zarizeni,
  servisni plany, tikety a nejde zalozit tiket).

  Nahrada: is_portal_client_of_project() - SECURITY DEFINER, stejna
  semantika (clients.portal_user_id), ale vnorene RLS ji nezastavi.
  Stejny vzor uz pouzivaji faktury, viceprace i pripominky.
*/

DROP POLICY IF EXISTS "Portal users can read own project devices" ON installed_devices;
CREATE POLICY "Portal users can read own project devices"
  ON installed_devices FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

DROP POLICY IF EXISTS "Portal users can read own project schedules" ON service_schedules;
CREATE POLICY "Portal users can read own project schedules"
  ON service_schedules FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

DROP POLICY IF EXISTS "Portal users can read own project tickets" ON service_tickets;
CREATE POLICY "Portal users can read own project tickets"
  ON service_tickets FOR SELECT TO authenticated
  USING (is_portal_client_of_project(project_id));

DROP POLICY IF EXISTS "Portal users can create tickets for own projects" ON service_tickets;
CREATE POLICY "Portal users can create tickets for own projects"
  ON service_tickets FOR INSERT TO authenticated
  WITH CHECK (
    reported_by_portal = true
    AND portal_user_id = auth.uid()
    AND is_portal_client_of_project(project_id)
  );

-- Kontrola: prihlaseny portalovy klient v zalozce Servis vidi zarizeni
-- a plany sveho projektu a zalozi tiket.
