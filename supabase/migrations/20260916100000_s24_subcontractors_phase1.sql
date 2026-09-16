/*
  # S24: Modul Subdodavatelé — fáze 1 (evidence + smlouvy)

  - `subcontractors`: karta subdodavatele (firma/OSVČ, řemesla, sazba,
    hodnocení) — org-scoped.
  - `subcontractor_documents`: dokumenty s expirací (pojištění, oprávnění,
    BOZP...) — org-scoped, soubory v bucketu `uploads` (stejně jako přijaté
    faktury).
  - `job_subcontractors`: vazba zakázka × subdodavatel (řemeslo, dohodnutá
    cena, stav, odkaz na vygenerovanou smlouvu).
  - Rozšíření CHECK na document_templates o typy 'smlouva' a 'objednavka'
    (TS typ je už zná, původní constraint ne).
  - Výchozí šablona „Smlouva o dílo — subdodavatel" pro každou organizaci,
    která ji nemá.

  RLS dle vzoru z S22/S23: přímý org sloupec + current_org_id(), role až
  uvnitř organizace, autofill trigger set_organization_id().
*/

-- ============================================================ subcontractors
CREATE TABLE IF NOT EXISTS subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  sub_type text NOT NULL DEFAULT 'company' CHECK (sub_type IN ('company', 'individual')),
  name text NOT NULL,
  ico text NOT NULL DEFAULT '',
  dic text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  trades text[] NOT NULL DEFAULT '{}',
  hourly_rate numeric NOT NULL DEFAULT 0,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_subcontractors_org ON subcontractors(organization_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_trades ON subcontractors USING gin(trades);

DROP TRIGGER IF EXISTS set_org_id ON subcontractors;
CREATE TRIGGER set_org_id BEFORE INSERT ON subcontractors
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP POLICY IF EXISTS "Org members can view subcontractors" ON subcontractors;
CREATE POLICY "Org members can view subcontractors"
  ON subcontractors FOR SELECT TO authenticated
  USING (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can insert subcontractors" ON subcontractors;
CREATE POLICY "Org members can insert subcontractors"
  ON subcontractors FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can update subcontractors" ON subcontractors;
CREATE POLICY "Org members can update subcontractors"
  ON subcontractors FOR UPDATE TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org admins can delete subcontractors" ON subcontractors;
CREATE POLICY "Org admins can delete subcontractors"
  ON subcontractors FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND is_full_admin());

-- ============================================================ subcontractor_documents
CREATE TABLE IF NOT EXISTS subcontractor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'jine' CHECK (doc_type IN ('pojisteni', 'opravneni', 'bozp', 'smlouva', 'jine')),
  name text NOT NULL,
  file_url text NOT NULL DEFAULT '',
  valid_until date,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subcontractor_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_subcontractor_documents_org ON subcontractor_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_documents_sub ON subcontractor_documents(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_documents_valid ON subcontractor_documents(valid_until);

DROP TRIGGER IF EXISTS set_org_id ON subcontractor_documents;
CREATE TRIGGER set_org_id BEFORE INSERT ON subcontractor_documents
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP POLICY IF EXISTS "Org members can view subcontractor documents" ON subcontractor_documents;
CREATE POLICY "Org members can view subcontractor documents"
  ON subcontractor_documents FOR SELECT TO authenticated
  USING (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can insert subcontractor documents" ON subcontractor_documents;
CREATE POLICY "Org members can insert subcontractor documents"
  ON subcontractor_documents FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can update subcontractor documents" ON subcontractor_documents;
CREATE POLICY "Org members can update subcontractor documents"
  ON subcontractor_documents FOR UPDATE TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can delete subcontractor documents" ON subcontractor_documents;
CREATE POLICY "Org members can delete subcontractor documents"
  ON subcontractor_documents FOR DELETE TO authenticated
  USING (organization_id = current_org_id());

-- ============================================================ job_subcontractors
CREATE TABLE IF NOT EXISTS job_subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  trade text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  agreed_price numeric NOT NULL DEFAULT 0,
  date_from date,
  date_to date,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'contract_generated', 'contract_signed', 'completed', 'cancelled')),
  contract_document_id uuid REFERENCES project_documents(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_subcontractors ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_job_subcontractors_org ON job_subcontractors(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_subcontractors_job ON job_subcontractors(job_id);
CREATE INDEX IF NOT EXISTS idx_job_subcontractors_sub ON job_subcontractors(subcontractor_id);

DROP TRIGGER IF EXISTS set_org_id ON job_subcontractors;
CREATE TRIGGER set_org_id BEFORE INSERT ON job_subcontractors
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP POLICY IF EXISTS "Org members can view job subcontractors" ON job_subcontractors;
CREATE POLICY "Org members can view job subcontractors"
  ON job_subcontractors FOR SELECT TO authenticated
  USING (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can insert job subcontractors" ON job_subcontractors;
CREATE POLICY "Org members can insert job subcontractors"
  ON job_subcontractors FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id()
              AND EXISTS (SELECT 1 FROM jobs j
                          WHERE j.id = job_subcontractors.job_id
                            AND j.organization_id = current_org_id()));
DROP POLICY IF EXISTS "Org members can update job subcontractors" ON job_subcontractors;
CREATE POLICY "Org members can update job subcontractors"
  ON job_subcontractors FOR UPDATE TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can delete job subcontractors" ON job_subcontractors;
CREATE POLICY "Org members can delete job subcontractors"
  ON job_subcontractors FOR DELETE TO authenticated
  USING (organization_id = current_org_id());

-- ============================================================ typy šablon
-- Původní CHECK nezná 'smlouva' a 'objednavka' (TS typ je už používá).
-- V datech mohou být i starší/neznámé typy — před přidáním kontroly je
-- znormalizujeme (legacy 'smlouva_o_dilo' → 'smlouva', ostatní → 'obecny'),
-- jinak ADD CONSTRAINT selže na existujících řádcích (23514).
ALTER TABLE document_templates DROP CONSTRAINT IF EXISTS valid_template_type;
UPDATE document_templates SET template_type = 'smlouva'
  WHERE template_type IN ('smlouva_o_dilo', 'sod', 'contract');
UPDATE document_templates SET template_type = 'obecny'
  WHERE template_type NOT IN ('zapis_stavba', 'predavaci_protokol', 'servisni_protokol', 'checklist', 'obecny', 'smlouva', 'objednavka');
ALTER TABLE document_templates ADD CONSTRAINT valid_template_type
  CHECK (template_type IN ('zapis_stavba', 'predavaci_protokol', 'servisni_protokol', 'checklist', 'obecny', 'smlouva', 'objednavka'));

-- ============================================================ výchozí šablona SoD
INSERT INTO document_templates (organization_id, name, description, template_type, content, version, is_active)
SELECT o.id,
  'Smlouva o dílo — subdodavatel',
  'Výchozí šablona smlouvy o dílo se subdodavatelem. Upravte dle svých právních podkladů.',
  'smlouva',
  '<h1 style="text-align:center">SMLOUVA O DÍLO</h1>'
  || '<p style="text-align:center">uzavřená dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník</p>'
  || '<h2>I. Smluvní strany</h2>'
  || '<p><strong>Objednatel:</strong><br>{{company.name}}<br>IČO: {{company.ico}}, DIČ: {{company.dic}}<br>{{company.address}}, {{company.zip}} {{company.city}}</p>'
  || '<p><strong>Zhotovitel:</strong><br>{{subcontractor.name}}<br>IČO: {{subcontractor.ico}}, DIČ: {{subcontractor.dic}}<br>{{subcontractor.address}}, {{subcontractor.city}}<br>E-mail: {{subcontractor.email}}, tel.: {{subcontractor.phone}}</p>'
  || '<h2>II. Předmět díla</h2>'
  || '<p>Zhotovitel se zavazuje provést pro objednatele na zakázce <strong>{{project.name}}</strong> ({{project.address}}) tyto práce:</p>'
  || '<p>{{contract.scope}}</p>'
  || '<h2>III. Termín plnění</h2>'
  || '<p>Zahájení: {{contract.date_from}} &nbsp;&nbsp; Dokončení: {{contract.date_to}}</p>'
  || '<h2>IV. Cena díla</h2>'
  || '<p>Smluvní cena díla činí <strong>{{contract.price}}</strong> bez DPH. Cena je konečná a zahrnuje veškeré náklady zhotovitele.</p>'
  || '<h2>V. Ostatní ujednání</h2>'
  || '<p>Zhotovitel provede dílo na vlastní odpovědnost, s odbornou péčí a v souladu s platnými normami a předpisy BOZP. Záruka na dílo činí 24 měsíců od předání.</p>'
  || '<p style="margin-top:40px">V __________ dne {{today}}</p>'
  || '<table style="width:100%;margin-top:60px"><tr>'
  || '<td style="width:50%;text-align:center">.................................<br>za objednatele<br>{{company.name}}</td>'
  || '<td style="width:50%;text-align:center">.................................<br>za zhotovitele<br>{{subcontractor.name}}</td>'
  || '</tr></table>',
  1, true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates t
  WHERE t.organization_id = o.id AND t.name = 'Smlouva o dílo — subdodavatel'
);
