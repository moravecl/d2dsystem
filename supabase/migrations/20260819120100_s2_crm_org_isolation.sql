/*
  # S2: Izolace CRM tabulek klientů podle organizace

  ## Problém (kritický, GDPR)
  client_contacts, client_addresses, client_notes a client_documents měly
  SELECT USING (true) a zápisy vázané jen na přihlášení / autorství.
  Kterýkoli přihlášený uživatel četl a upravoval osobní údaje klientů
  všech firem.

  ## Oprava
  1. Přidat organization_id (FK na organizations) do všech čtyř tabulek
  2. Backfill z nadřazené tabulky clients (ta už organization_id má)
  3. BEFORE INSERT trigger vždy odvodí organization_id z client_id
     (klientem poslaná hodnota se přepíše — nelze podvrhnout)
  4. Nové politiky: vše omezeno na organization_id = get_my_organization_id();
     u poznámek a dokumentů navíc zachováno původní pravidlo autorství
     pro UPDATE/DELETE

  Pozn.: NOT NULL záměrně nevynucujeme kvůli případným legacy řádkům,
  jejichž klient nemá organization_id; RLS je i tak nepustí nikomu.
*/

-- ============================================================
-- 1. Sloupce organization_id + indexy
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_contacts','client_addresses','client_notes','client_documents'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'organization_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE', t);
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_org ON %I(organization_id)', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 2. Backfill z clients
-- ============================================================
UPDATE client_contacts cc SET organization_id = c.organization_id
  FROM clients c WHERE c.id = cc.client_id AND cc.organization_id IS NULL;
UPDATE client_addresses ca SET organization_id = c.organization_id
  FROM clients c WHERE c.id = ca.client_id AND ca.organization_id IS NULL;
UPDATE client_notes cn SET organization_id = c.organization_id
  FROM clients c WHERE c.id = cn.client_id AND cn.organization_id IS NULL;
UPDATE client_documents cd SET organization_id = c.organization_id
  FROM clients c WHERE c.id = cd.client_id AND cd.organization_id IS NULL;

-- ============================================================
-- 3. Trigger: organization_id se vždy odvodí z client_id
-- ============================================================
CREATE OR REPLACE FUNCTION set_client_child_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM clients WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_contacts_org ON client_contacts;
CREATE TRIGGER trg_client_contacts_org BEFORE INSERT OR UPDATE OF client_id ON client_contacts
  FOR EACH ROW EXECUTE FUNCTION set_client_child_org();
DROP TRIGGER IF EXISTS trg_client_addresses_org ON client_addresses;
CREATE TRIGGER trg_client_addresses_org BEFORE INSERT OR UPDATE OF client_id ON client_addresses
  FOR EACH ROW EXECUTE FUNCTION set_client_child_org();
DROP TRIGGER IF EXISTS trg_client_notes_org ON client_notes;
CREATE TRIGGER trg_client_notes_org BEFORE INSERT OR UPDATE OF client_id ON client_notes
  FOR EACH ROW EXECUTE FUNCTION set_client_child_org();
DROP TRIGGER IF EXISTS trg_client_documents_org ON client_documents;
CREATE TRIGGER trg_client_documents_org BEFORE INSERT OR UPDATE OF client_id ON client_documents
  FOR EACH ROW EXECUTE FUNCTION set_client_child_org();

-- ============================================================
-- 4. Politiky
-- ============================================================

-- client_contacts
DROP POLICY IF EXISTS "Authenticated users can read client contacts" ON client_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert client contacts" ON client_contacts;
DROP POLICY IF EXISTS "Authenticated users can update client contacts" ON client_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete client contacts" ON client_contacts;

CREATE POLICY "Org members can read client contacts"
  ON client_contacts FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());
CREATE POLICY "Org members can insert client contacts"
  ON client_contacts FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can update client contacts"
  ON client_contacts FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can delete client contacts"
  ON client_contacts FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- client_addresses
DROP POLICY IF EXISTS "Authenticated users can read client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Authenticated users can insert client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Authenticated users can update client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Authenticated users can delete client addresses" ON client_addresses;

CREATE POLICY "Org members can read client addresses"
  ON client_addresses FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());
CREATE POLICY "Org members can insert client addresses"
  ON client_addresses FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can update client addresses"
  ON client_addresses FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id())
  WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "Org members can delete client addresses"
  ON client_addresses FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

-- client_notes (autorství zachováno pro UPDATE/DELETE)
DROP POLICY IF EXISTS "Authenticated users can read client notes" ON client_notes;
DROP POLICY IF EXISTS "Authenticated users can insert client notes" ON client_notes;
DROP POLICY IF EXISTS "Note authors can update their notes" ON client_notes;
DROP POLICY IF EXISTS "Note authors can delete their notes" ON client_notes;

CREATE POLICY "Org members can read client notes"
  ON client_notes FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());
CREATE POLICY "Org members can insert client notes"
  ON client_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id() AND auth.uid() = created_by);
CREATE POLICY "Note authors can update their notes"
  ON client_notes FOR UPDATE TO authenticated
  USING (organization_id = get_my_organization_id() AND auth.uid() = created_by)
  WITH CHECK (organization_id = get_my_organization_id() AND auth.uid() = created_by);
CREATE POLICY "Note authors can delete their notes"
  ON client_notes FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id() AND auth.uid() = created_by);

-- client_documents (autorství zachováno pro DELETE)
DROP POLICY IF EXISTS "Authenticated users can read client documents" ON client_documents;
DROP POLICY IF EXISTS "Authenticated users can insert client documents" ON client_documents;
DROP POLICY IF EXISTS "Document uploaders can delete their documents" ON client_documents;

CREATE POLICY "Org members can read client documents"
  ON client_documents FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());
CREATE POLICY "Org members can insert client documents"
  ON client_documents FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id() AND auth.uid() = uploaded_by);
CREATE POLICY "Document uploaders can delete their documents"
  ON client_documents FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id() AND auth.uid() = uploaded_by);
