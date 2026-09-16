/*
  # S25: Modul Subdodavatelé — fáze 2 (portál + poptávky)

  - `subcontractor_users`: portálové účty subdodavatelů (1 subka : N uživatelů).
    Párování přes e-mail: org zadá e-mail, po přihlášení se účet přiváže
    RPC `link_subcontractor_user()`. Subka NIKDY nedostává org členství —
    stejný princip jako klientský portál (S14).
  - `sub_inquiries` + `sub_inquiry_recipients`: hromadné poptávky ze zakázky
    (pevná cena / nabídková, počet lidí, přepínač anonymity klienta).
  - Odpovědi subky a potvrzení smlouvy jdou VÝHRADNĚ přes SECURITY DEFINER
    RPC (respond_sub_inquiry, confirm_sub_contract) — portál nemá přímé
    UPDATE právo, takže nemůže manipulovat stavy ani cizí sloupce.
  - Portálové čtecí policies přes SECURITY DEFINER helpery (lekce S14:
    vnořené EXISTS přes org-scoped tabulky pod RLS selžou).
*/

-- ============================================================ subcontractor_users
CREATE TABLE IF NOT EXISTS subcontractor_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subcontractor_users ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subcontractor_users_email
  ON subcontractor_users (subcontractor_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_subcontractor_users_user ON subcontractor_users(user_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_users_org ON subcontractor_users(organization_id);

DROP TRIGGER IF EXISTS set_org_id ON subcontractor_users;
CREATE TRIGGER set_org_id BEFORE INSERT ON subcontractor_users
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP POLICY IF EXISTS "Org members manage subcontractor users" ON subcontractor_users;
CREATE POLICY "Org members manage subcontractor users"
  ON subcontractor_users FOR ALL TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Sub users read own mapping" ON subcontractor_users;
CREATE POLICY "Sub users read own mapping"
  ON subcontractor_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Přiváže přihlášeného uživatele k pozvánkám podle e-mailu.
CREATE OR REPLACE FUNCTION link_subcontractor_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_count int;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN false; END IF;
  UPDATE subcontractor_users
    SET user_id = auth.uid()
    WHERE lower(email) = v_email AND user_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0 OR EXISTS (
    SELECT 1 FROM subcontractor_users WHERE user_id = auth.uid()
  );
END;
$$;

-- ============================================================ helpery
CREATE OR REPLACE FUNCTION current_subcontractor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subcontractor_id FROM subcontractor_users WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_subcontractor_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_subcontractor_id() IS NOT NULL;
$$;

-- ============================================================ sub_inquiries
CREATE TABLE IF NOT EXISTS sub_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  scope text NOT NULL DEFAULT '',
  trade text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'bid' CHECK (mode IN ('fixed_price', 'bid')),
  fixed_price numeric NOT NULL DEFAULT 0,
  people_needed integer NOT NULL DEFAULT 1,
  reveal_client boolean NOT NULL DEFAULT false,
  place text NOT NULL DEFAULT '',
  date_from date,
  date_to date,
  response_deadline date,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'closed', 'awarded', 'cancelled')),
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sub_inquiries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_inquiries_org ON sub_inquiries(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_inquiries_job ON sub_inquiries(job_id);

DROP TRIGGER IF EXISTS set_org_id ON sub_inquiries;
CREATE TRIGGER set_org_id BEFORE INSERT ON sub_inquiries
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- ============================================================ sub_inquiry_recipients
CREATE TABLE IF NOT EXISTS sub_inquiry_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  inquiry_id uuid NOT NULL REFERENCES sub_inquiries(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'declined', 'offered', 'accepted')),
  offer_price numeric,
  offer_note text NOT NULL DEFAULT '',
  people_offered integer,
  responded_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_job_subcontractor_id uuid REFERENCES job_subcontractors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inquiry_id, subcontractor_id)
);

ALTER TABLE sub_inquiry_recipients ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_inquiry_recipients_org ON sub_inquiry_recipients(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_inquiry_recipients_inq ON sub_inquiry_recipients(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_sub_inquiry_recipients_sub ON sub_inquiry_recipients(subcontractor_id);

DROP TRIGGER IF EXISTS set_org_id ON sub_inquiry_recipients;
CREATE TRIGGER set_org_id BEFORE INSERT ON sub_inquiry_recipients
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- helper až po tabulkách (odkazuje na ně)
CREATE OR REPLACE FUNCTION is_sub_recipient_of_inquiry(p_inquiry uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_inquiry_recipients r
    WHERE r.inquiry_id = p_inquiry
      AND r.subcontractor_id = current_subcontractor_id()
  );
$$;

CREATE OR REPLACE FUNCTION is_sub_on_project(p_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_inquiry_recipients r
    JOIN sub_inquiries i ON i.id = r.inquiry_id
    WHERE i.project_id = p_project
      AND r.subcontractor_id = current_subcontractor_id()
  ) OR EXISTS (
    SELECT 1 FROM job_subcontractors js
    JOIN jobs j ON j.id = js.job_id
    WHERE j.project_id = p_project
      AND js.subcontractor_id = current_subcontractor_id()
  );
$$;

CREATE OR REPLACE FUNCTION is_sub_contract_document(p_document uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_subcontractors js
    WHERE js.contract_document_id = p_document
      AND js.subcontractor_id = current_subcontractor_id()
  );
$$;

-- ============================================================ RLS poptávek
DROP POLICY IF EXISTS "Org members manage sub inquiries" ON sub_inquiries;
CREATE POLICY "Org members manage sub inquiries"
  ON sub_inquiries FOR ALL TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Sub recipients read inquiries" ON sub_inquiries;
CREATE POLICY "Sub recipients read inquiries"
  ON sub_inquiries FOR SELECT TO authenticated
  USING (status <> 'draft' AND is_sub_recipient_of_inquiry(id));

DROP POLICY IF EXISTS "Org members manage inquiry recipients" ON sub_inquiry_recipients;
CREATE POLICY "Org members manage inquiry recipients"
  ON sub_inquiry_recipients FOR ALL TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Sub users read own recipient rows" ON sub_inquiry_recipients;
CREATE POLICY "Sub users read own recipient rows"
  ON sub_inquiry_recipients FOR SELECT TO authenticated
  USING (subcontractor_id = current_subcontractor_id());

-- ============================================================ portálové čtení navázaných dat
DROP POLICY IF EXISTS "Subcontractors read own card" ON subcontractors;
CREATE POLICY "Subcontractors read own card"
  ON subcontractors FOR SELECT TO authenticated
  USING (id = current_subcontractor_id());

DROP POLICY IF EXISTS "Subcontractors read own job assignments" ON job_subcontractors;
CREATE POLICY "Subcontractors read own job assignments"
  ON job_subcontractors FOR SELECT TO authenticated
  USING (subcontractor_id = current_subcontractor_id());

DROP POLICY IF EXISTS "Subcontractors read project milestones" ON project_milestones;
CREATE POLICY "Subcontractors read project milestones"
  ON project_milestones FOR SELECT TO authenticated
  USING (is_sub_on_project(project_id));

DROP POLICY IF EXISTS "Subcontractors read own contract documents" ON project_documents;
CREATE POLICY "Subcontractors read own contract documents"
  ON project_documents FOR SELECT TO authenticated
  USING (is_sub_contract_document(id));

-- ============================================================ potvrzení smlouvy
CREATE TABLE IF NOT EXISTS sub_contract_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_subcontractor_id uuid NOT NULL REFERENCES job_subcontractors(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NOT NULL DEFAULT ''
);

ALTER TABLE sub_contract_confirmations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_contract_confirmations_js ON sub_contract_confirmations(job_subcontractor_id);

DROP POLICY IF EXISTS "Org members read contract confirmations" ON sub_contract_confirmations;
CREATE POLICY "Org members read contract confirmations"
  ON sub_contract_confirmations FOR SELECT TO authenticated
  USING (organization_id = current_org_id());
DROP POLICY IF EXISTS "Subcontractors read own confirmations" ON sub_contract_confirmations;
CREATE POLICY "Subcontractors read own confirmations"
  ON sub_contract_confirmations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM job_subcontractors js
    WHERE js.id = sub_contract_confirmations.job_subcontractor_id
      AND js.subcontractor_id = current_subcontractor_id()
  ));

-- ============================================================ RPC: odpověď subky
-- Portál nemá UPDATE právo — odpovědi jen tudy, s validací stavů a deadlinu.
CREATE OR REPLACE FUNCTION respond_sub_inquiry(
  p_recipient uuid,
  p_action text,
  p_price numeric DEFAULT NULL,
  p_note text DEFAULT '',
  p_people integer DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec sub_inquiry_recipients;
  v_inq sub_inquiries;
  v_sub_name text;
BEGIN
  SELECT * INTO v_rec FROM sub_inquiry_recipients WHERE id = p_recipient;
  IF v_rec IS NULL OR v_rec.subcontractor_id IS DISTINCT FROM current_subcontractor_id() THEN
    RAISE EXCEPTION 'Poptávka nenalezena';
  END IF;
  SELECT * INTO v_inq FROM sub_inquiries WHERE id = v_rec.inquiry_id;

  IF p_action = 'viewed' THEN
    IF v_rec.status = 'sent' THEN
      UPDATE sub_inquiry_recipients SET status = 'viewed' WHERE id = p_recipient;
    END IF;
    RETURN 'ok';
  END IF;

  IF v_inq.status <> 'sent' THEN
    RAISE EXCEPTION 'Poptávka už není otevřená';
  END IF;
  IF v_inq.response_deadline IS NOT NULL AND CURRENT_DATE > v_inq.response_deadline THEN
    RAISE EXCEPTION 'Termín pro odpověď vypršel';
  END IF;
  IF v_rec.status IN ('accepted', 'offered', 'declined') AND p_action <> 'decline' THEN
    RAISE EXCEPTION 'Na poptávku už jste odpověděli';
  END IF;

  IF p_action = 'accept' THEN
    IF v_inq.mode <> 'fixed_price' THEN RAISE EXCEPTION 'Tato poptávka očekává cenovou nabídku'; END IF;
    UPDATE sub_inquiry_recipients
      SET status = 'accepted', offer_note = COALESCE(p_note, ''),
          people_offered = p_people, responded_at = now()
      WHERE id = p_recipient;
  ELSIF p_action = 'offer' THEN
    IF v_inq.mode <> 'bid' THEN RAISE EXCEPTION 'Tato poptávka má pevnou cenu'; END IF;
    IF p_price IS NULL OR p_price <= 0 THEN RAISE EXCEPTION 'Zadejte nabídkovou cenu'; END IF;
    UPDATE sub_inquiry_recipients
      SET status = 'offered', offer_price = p_price, offer_note = COALESCE(p_note, ''),
          people_offered = p_people, responded_at = now()
      WHERE id = p_recipient;
  ELSIF p_action = 'decline' THEN
    UPDATE sub_inquiry_recipients
      SET status = 'declined', offer_note = COALESCE(p_note, ''), responded_at = now()
      WHERE id = p_recipient;
  ELSE
    RAISE EXCEPTION 'Neznámá akce';
  END IF;

  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_rec.subcontractor_id;
  PERFORM notify_org_users(
    v_inq.organization_id, ARRAY['owner','admin','manager','employee'],
    'sub_inquiry',
    CASE p_action
      WHEN 'accept' THEN 'Subdodavatel přijal poptávku'
      WHEN 'offer' THEN 'Nová nabídka od subdodavatele'
      ELSE 'Subdodavatel odmítl poptávku'
    END,
    v_sub_name || ' — ' || v_inq.title,
    'sub_inquiry', v_inq.id,
    '/subdodavatele',
    'sub_inquiry_response',
    'sub_inquiry_response:' || p_recipient::text || ':' || p_action
  );

  RETURN 'ok';
END;
$$;

-- ============================================================ RPC: potvrzení smlouvy
CREATE OR REPLACE FUNCTION confirm_sub_contract(p_job_sub uuid, p_user_agent text DEFAULT '')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_js job_subcontractors;
  v_sub_name text;
  v_project_name text;
BEGIN
  SELECT * INTO v_js FROM job_subcontractors WHERE id = p_job_sub;
  IF v_js IS NULL OR v_js.subcontractor_id IS DISTINCT FROM current_subcontractor_id() THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;
  IF v_js.contract_document_id IS NULL THEN
    RAISE EXCEPTION 'Smlouva zatím nebyla vygenerována';
  END IF;
  IF v_js.status = 'contract_signed' THEN
    RETURN 'ok';
  END IF;

  INSERT INTO sub_contract_confirmations (organization_id, job_subcontractor_id, user_id, user_agent)
  VALUES (v_js.organization_id, v_js.id, auth.uid(), COALESCE(p_user_agent, ''));

  UPDATE job_subcontractors
    SET status = 'contract_signed', updated_at = now()
    WHERE id = v_js.id;

  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_js.subcontractor_id;
  SELECT p.project_name INTO v_project_name
    FROM jobs j JOIN projects p ON p.id = j.project_id WHERE j.id = v_js.job_id;

  PERFORM notify_org_users(
    v_js.organization_id, ARRAY['owner','admin','manager','employee'],
    'sub_contract',
    'Subdodavatel potvrdil smlouvu o dílo',
    COALESCE(v_sub_name, '') || ' — ' || COALESCE(v_project_name, ''),
    'job_subcontractor', v_js.id,
    '/subdodavatele',
    'sub_contract_confirmed',
    'sub_contract_confirmed:' || v_js.id::text
  );

  RETURN 'ok';
END;
$$;
