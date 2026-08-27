/*
  # S18: Konfigurator predbeznych cenovych nabidek

  Port aplikace "HouseSmart Manager" do systemu:
  1. configurator_settings - cenik konfiguratoru per organizace
     (katalogy voleb, jednotkove ceny, vychozi marze/poplatky) jako
     jsonb; edituje se v administraci. Bez radku plati vychozi cenik
     zabudovany v aplikaci.
  2. preliminary_quotes - ulozene predbezne nabidky (klient, stav
     konfigurace, snapshot souctu, stav draft/sent/accepted/rejected,
     volitelna vazba na lead ci projekt).
*/

CREATE TABLE IF NOT EXISTS configurator_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configurator_settings_org_unique UNIQUE (organization_id)
);

ALTER TABLE configurator_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read configurator settings" ON configurator_settings;
CREATE POLICY "Org members can read configurator settings"
  ON configurator_settings FOR SELECT TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user());

DROP POLICY IF EXISTS "Org admins can insert configurator settings" ON configurator_settings;
CREATE POLICY "Org admins can insert configurator settings"
  ON configurator_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id() AND is_full_admin());

DROP POLICY IF EXISTS "Org admins can update configurator settings" ON configurator_settings;
CREATE POLICY "Org admins can update configurator settings"
  ON configurator_settings FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND is_full_admin())
  WITH CHECK (organization_id = current_org_id());

CREATE TABLE IF NOT EXISTS preliminary_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  client jsonb NOT NULL DEFAULT '{}',
  state jsonb NOT NULL DEFAULT '{}',
  totals jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE preliminary_quotes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_preliminary_quotes_org ON preliminary_quotes (organization_id, updated_at DESC);

DROP TRIGGER IF EXISTS s7_fill_org ON preliminary_quotes;
CREATE TRIGGER s7_fill_org BEFORE INSERT ON preliminary_quotes
  FOR EACH ROW EXECUTE FUNCTION s7_fill_organization_id();

DROP POLICY IF EXISTS "Org members can read preliminary quotes" ON preliminary_quotes;
CREATE POLICY "Org members can read preliminary quotes"
  ON preliminary_quotes FOR SELECT TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user());

DROP POLICY IF EXISTS "Org members can insert preliminary quotes" ON preliminary_quotes;
CREATE POLICY "Org members can insert preliminary quotes"
  ON preliminary_quotes FOR INSERT TO authenticated
  WITH CHECK ((organization_id = current_org_id() OR organization_id IS NULL) AND NOT is_portal_client_user());

DROP POLICY IF EXISTS "Org members can update preliminary quotes" ON preliminary_quotes;
CREATE POLICY "Org members can update preliminary quotes"
  ON preliminary_quotes FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user())
  WITH CHECK (organization_id = current_org_id());

DROP POLICY IF EXISTS "Org members can delete preliminary quotes" ON preliminary_quotes;
CREATE POLICY "Org members can delete preliminary quotes"
  ON preliminary_quotes FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user());

-- Kontrola:
--   select count(*) from pg_policies where tablename in
--     ('configurator_settings','preliminary_quotes');  -> 7
