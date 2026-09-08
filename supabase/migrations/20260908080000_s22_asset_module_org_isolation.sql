/*
  # S22: Izolace modulu Majetek mezi organizacemi

  ## Problém
  assets, asset_events (servisní historie), due_items a asset_documents měly
  policies "EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())",
  tedy plný přístup pro KAŽDÉHO přihlášeného napříč organizacemi. Sweep S7
  je přeskočil, protože vzor "= auth.uid()" vyhodnotil jako per-user policy.
  asset_events, due_items a asset_documents navíc neměly organization_id.

  ## Oprava
  1. Doplnění organization_id + backfill z assets (přes asset_id).
  2. Autofill trigger set_org_id (stejný vzor jako ostatní tabulky).
  3. Všechny stávající policies těchto 4 tabulek se zahodí a nahradí
     org-scoped sadou (SELECT/INSERT/UPDATE v rámci organizace,
     DELETE navíc jen is_full_admin()).
*/

-- 1) chybějící org sloupce + backfill
ALTER TABLE asset_events    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE due_items       ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE asset_documents ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE asset_events e SET organization_id = a.organization_id
FROM assets a WHERE a.id = e.asset_id AND e.organization_id IS NULL;

UPDATE due_items d SET organization_id = a.organization_id
FROM assets a WHERE a.id = d.asset_id AND d.organization_id IS NULL;

UPDATE asset_documents doc SET organization_id = a.organization_id
FROM assets a WHERE a.id = doc.asset_id AND doc.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_asset_events_org    ON asset_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_due_items_org       ON due_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_org ON asset_documents(organization_id);

-- 2) autofill triggery (set_organization_id existuje z 20260218204906)
DROP TRIGGER IF EXISTS set_org_id ON asset_events;
CREATE TRIGGER set_org_id BEFORE INSERT ON asset_events
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();
DROP TRIGGER IF EXISTS set_org_id ON due_items;
CREATE TRIGGER set_org_id BEFORE INSERT ON due_items
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();
DROP TRIGGER IF EXISTS set_org_id ON asset_documents;
CREATE TRIGGER set_org_id BEFORE INSERT ON asset_documents
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- 3) kompletní přepolicování všech 4 tabulek
DO $$
DECLARE
  t text;
  r record;
BEGIN
  FOREACH t IN ARRAY ARRAY['assets', 'asset_events', 'due_items', 'asset_documents'] LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', r.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY "Org members can view %s" ON %I FOR SELECT TO authenticated
         USING (organization_id = current_org_id())', t, t);
    EXECUTE format(
      'CREATE POLICY "Org members can insert %s" ON %I FOR INSERT TO authenticated
         WITH CHECK (organization_id = current_org_id())', t, t);
    EXECUTE format(
      'CREATE POLICY "Org members can update %s" ON %I FOR UPDATE TO authenticated
         USING (organization_id = current_org_id())
         WITH CHECK (organization_id = current_org_id())', t, t);
    EXECUTE format(
      'CREATE POLICY "Org admins can delete %s" ON %I FOR DELETE TO authenticated
         USING (organization_id = current_org_id() AND is_full_admin())', t, t);
  END LOOP;
END $$;
