/*
  # S10: Zaklad pro workflow projektu
  (nabidka -> smlouva/objednavka -> realizace -> zapisy -> predavaci protokol
   -> dodaci list -> faktura vcetne dilcich)

  Jedna migrace pro vsechny faze A-D. Frontend se nasazuje postupne,
  schema je pripravene cele dopredu.

  1. organizations.workflow_enforcement - prepinac prisnosti (guide|confirm)
     + politika, aby nastaveni mohl ulozit i org admin (dnes jen owner)
  2. job_worklogs: hourly_rate (snapshot sazby), billed_invoice_id, billed_at
  3. job_material_entries: billed_invoice_id, billed_at, delivery_note_id
  4. delivery_notes + delivery_note_items (dodaci listy) vcetne RLS
  5. document_templates/project_documents: typy smlouva a objednavka,
     podpisy a stav SIGNED na projektovych dokumentech
  Pozn.: project_protocols.protocol_type nema CHECK - typ 'handover'
  zadne DDL nepotrebuje.
*/

-- ============================================================
-- 1. Prepinac prisnosti workflow
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'workflow_enforcement'
  ) THEN
    ALTER TABLE organizations
      ADD COLUMN workflow_enforcement text NOT NULL DEFAULT 'guide'
      CHECK (workflow_enforcement IN ('guide', 'confirm'));
  END IF;
END $$;

-- Nastaveni organizace smel ulozit jen owner; org admin ma mit totez pravo.
DROP POLICY IF EXISTS "Org admins can update their organization" ON organizations;
CREATE POLICY "Org admins can update their organization"
  ON organizations FOR UPDATE TO authenticated
  USING (id = current_org_id() AND is_full_admin())
  WITH CHECK (id = current_org_id() AND is_full_admin());

-- ============================================================
-- 2. Zapisy prace: sazba + priznak vyuctovani
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_worklogs' AND column_name = 'hourly_rate') THEN
    ALTER TABLE job_worklogs ADD COLUMN hourly_rate numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_worklogs' AND column_name = 'billed_invoice_id') THEN
    ALTER TABLE job_worklogs ADD COLUMN billed_invoice_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_worklogs' AND column_name = 'billed_at') THEN
    ALTER TABLE job_worklogs ADD COLUMN billed_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 3. Material: priznak vyuctovani + vazba na dodaci list
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_material_entries' AND column_name = 'billed_invoice_id') THEN
    ALTER TABLE job_material_entries ADD COLUMN billed_invoice_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_material_entries' AND column_name = 'billed_at') THEN
    ALTER TABLE job_material_entries ADD COLUMN billed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_material_entries' AND column_name = 'delivery_note_id') THEN
    ALTER TABLE job_material_entries ADD COLUMN delivery_note_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_worklogs_billed
  ON job_worklogs (job_id) WHERE billed_invoice_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_material_billed
  ON job_material_entries (job_id) WHERE billed_invoice_id IS NULL;

-- ============================================================
-- 4. Dodaci listy
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  job_id uuid,
  number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  note text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  client_address text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  material_entry_id uuid,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'ks',
  quantity numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_notes_org ON delivery_notes (organization_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_project ON delivery_notes (project_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_note ON delivery_note_items (delivery_note_id);

-- org autofill pri INSERTu (aplikace organization_id neposila)
DROP TRIGGER IF EXISTS s7_fill_org ON delivery_notes;
CREATE TRIGGER s7_fill_org BEFORE INSERT ON delivery_notes
  FOR EACH ROW EXECUTE FUNCTION s7_fill_organization_id();

DROP POLICY IF EXISTS "Org members can read delivery notes" ON delivery_notes;
CREATE POLICY "Org members can read delivery notes"
  ON delivery_notes FOR SELECT TO authenticated
  USING (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can insert delivery notes" ON delivery_notes;
CREATE POLICY "Org members can insert delivery notes"
  ON delivery_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can update delivery notes" ON delivery_notes;
CREATE POLICY "Org members can update delivery notes"
  ON delivery_notes FOR UPDATE TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can delete delivery notes" ON delivery_notes;
CREATE POLICY "Org members can delete delivery notes"
  ON delivery_notes FOR DELETE TO authenticated
  USING (organization_id = current_org_id());

DROP POLICY IF EXISTS "Org members can read delivery note items" ON delivery_note_items;
CREATE POLICY "Org members can read delivery note items"
  ON delivery_note_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM delivery_notes dn
    WHERE dn.id = delivery_note_items.delivery_note_id
      AND dn.organization_id = current_org_id()));
DROP POLICY IF EXISTS "Org members can insert delivery note items" ON delivery_note_items;
CREATE POLICY "Org members can insert delivery note items"
  ON delivery_note_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM delivery_notes dn
    WHERE dn.id = delivery_note_items.delivery_note_id
      AND dn.organization_id = current_org_id()));
DROP POLICY IF EXISTS "Org members can delete delivery note items" ON delivery_note_items;
CREATE POLICY "Org members can delete delivery note items"
  ON delivery_note_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM delivery_notes dn
    WHERE dn.id = delivery_note_items.delivery_note_id
      AND dn.organization_id = current_org_id()));

-- ============================================================
-- 5. Projektove dokumenty: smlouva, objednavka, podpisy
-- ============================================================
ALTER TABLE document_templates DROP CONSTRAINT IF EXISTS valid_template_type;
ALTER TABLE document_templates ADD CONSTRAINT valid_template_type
  CHECK (template_type IN ('obecny', 'predavaci_protokol', 'servisni_protokol',
                           'zapis_stavba', 'contract', 'smlouva', 'objednavka'));

ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS valid_doc_type;
ALTER TABLE project_documents ADD CONSTRAINT valid_doc_type
  CHECK (document_type IN ('obecny', 'predavaci_protokol', 'servisni_protokol',
                           'zapis_stavba', 'checklist', 'upload',
                           'smlouva', 'objednavka'));

ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS valid_doc_status;
ALTER TABLE project_documents ADD CONSTRAINT valid_doc_status
  CHECK (status IN ('DRAFT', 'FINAL', 'SIGNED'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_documents' AND column_name = 'client_signature') THEN
    ALTER TABLE project_documents ADD COLUMN client_signature text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_documents' AND column_name = 'contractor_signature') THEN
    ALTER TABLE project_documents ADD COLUMN contractor_signature text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_documents' AND column_name = 'signed_at') THEN
    ALTER TABLE project_documents ADD COLUMN signed_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- Kontrola po nasazeni:
--   select column_name from information_schema.columns
--   where table_name in ('job_worklogs','job_material_entries','project_documents')
--     and column_name in ('hourly_rate','billed_invoice_id','delivery_note_id',
--                         'client_signature','signed_at');
--   -> 7 radku
--   select count(*) from pg_policies where tablename like 'delivery_note%';
--   -> 7 politik
-- ============================================================
