/*
  # S27: Modul Subdodavatelé — fáze 3 (výkazy, soubory zakázky, faktury)

  - Výkazy práce a materiálu od subdodavatele: sloupce `submitted_by_sub`
    a `approval_status` na job_worklogs / job_material_entries. Subka
    vykazuje VÝHRADNĚ přes SECURITY DEFINER RPC (sub_log_work,
    sub_log_material) se stavem 'pending' — do podkladů fakturace se
    dostane až po schválení org (org UI filtruje approval_status).
  - `sub_job_files`: soubory zakázky sdílené mezi org a subkou (org
    nahrává podklady, subka fotky/revize). Explicitní sdílení — subka
    NIKDY nevidí soubory projektu ani cenové podklady.
  - `received_invoices.job_subcontractor_id`: párování přijaté faktury
    subky na subdodávku → skutečné náklady/marže zakázky.
*/

-- ============================================================ výkazy subky
ALTER TABLE job_worklogs
  ADD COLUMN IF NOT EXISTS submitted_by_sub uuid REFERENCES subcontractors(id) ON DELETE SET NULL;
ALTER TABLE job_worklogs
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE job_material_entries
  ADD COLUMN IF NOT EXISTS submitted_by_sub uuid REFERENCES subcontractors(id) ON DELETE SET NULL;
ALTER TABLE job_material_entries
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_job_worklogs_sub ON job_worklogs(submitted_by_sub) WHERE submitted_by_sub IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_material_entries_sub ON job_material_entries(submitted_by_sub) WHERE submitted_by_sub IS NOT NULL;

DROP POLICY IF EXISTS "Sub users read own worklogs" ON job_worklogs;
CREATE POLICY "Sub users read own worklogs"
  ON job_worklogs FOR SELECT TO authenticated
  USING (submitted_by_sub = current_subcontractor_id());

DROP POLICY IF EXISTS "Sub users read own material entries" ON job_material_entries;
CREATE POLICY "Sub users read own material entries"
  ON job_material_entries FOR SELECT TO authenticated
  USING (submitted_by_sub = current_subcontractor_id());

CREATE OR REPLACE FUNCTION is_own_job_subcontractor(p_js uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_subcontractors js
    WHERE js.id = p_js
      AND js.subcontractor_id = current_subcontractor_id()
  );
$$;

-- RPC: výkaz práce subky (pending, čeká na schválení org)
CREATE OR REPLACE FUNCTION sub_log_work(
  p_job_sub uuid,
  p_date date,
  p_hours numeric,
  p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_js job_subcontractors;
  v_sub_name text;
BEGIN
  SELECT * INTO v_js FROM job_subcontractors WHERE id = p_job_sub;
  IF v_js IS NULL OR v_js.subcontractor_id IS DISTINCT FROM current_subcontractor_id() THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;
  IF v_js.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Zakázka je uzavřená';
  END IF;
  IF p_hours IS NULL OR p_hours <= 0 OR p_hours > 24 THEN
    RAISE EXCEPTION 'Zadejte počet hodin (max 24)';
  END IF;

  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_js.subcontractor_id;

  INSERT INTO job_worklogs (job_id, user_id, activity, started_at, duration_minutes, note,
                            is_running, submitted_by_sub, approval_status)
  VALUES (v_js.job_id, auth.uid(),
          'Subdodávka — ' || COALESCE(v_sub_name, ''),
          p_date::timestamptz, round(p_hours * 60)::int, COALESCE(p_note, ''),
          false, v_js.subcontractor_id, 'pending');

  PERFORM notify_org_users(
    v_js.organization_id, ARRAY['owner','admin','manager','employee'],
    'sub_worklog', 'Subdodavatel vykázal práci',
    COALESCE(v_sub_name, '') || ' — ' || p_hours || ' h (' || to_char(p_date, 'DD.MM.YYYY') || ')',
    'job_subcontractor', v_js.id, '/subdodavatele', 'sub_worklog', NULL
  );
  RETURN 'ok';
END;
$$;

-- RPC: výkaz materiálu subky (pending)
CREATE OR REPLACE FUNCTION sub_log_material(
  p_job_sub uuid,
  p_name text,
  p_qty numeric,
  p_unit text DEFAULT 'ks',
  p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_js job_subcontractors;
  v_sub_name text;
BEGIN
  SELECT * INTO v_js FROM job_subcontractors WHERE id = p_job_sub;
  IF v_js IS NULL OR v_js.subcontractor_id IS DISTINCT FROM current_subcontractor_id() THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;
  IF v_js.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Zakázka je uzavřená';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Zadejte název materiálu';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Zadejte množství';
  END IF;

  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_js.subcontractor_id;

  INSERT INTO job_material_entries (job_id, material_name, unit, actual_qty, unit_price, note,
                                    is_unplanned, created_by, submitted_by_sub, approval_status)
  VALUES (v_js.job_id, btrim(p_name), COALESCE(NULLIF(p_unit, ''), 'ks'), p_qty, 0, COALESCE(p_note, ''),
          true, auth.uid(), v_js.subcontractor_id, 'pending');

  PERFORM notify_org_users(
    v_js.organization_id, ARRAY['owner','admin','manager','employee'],
    'sub_material', 'Subdodavatel vykázal materiál',
    COALESCE(v_sub_name, '') || ' — ' || btrim(p_name) || ' (' || p_qty || ' ' || COALESCE(NULLIF(p_unit, ''), 'ks') || ')',
    'job_subcontractor', v_js.id, '/subdodavatele', 'sub_material', NULL
  );
  RETURN 'ok';
END;
$$;

-- ============================================================ soubory zakázky
CREATE TABLE IF NOT EXISTS sub_job_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_subcontractor_id uuid NOT NULL REFERENCES job_subcontractors(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  by_sub boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sub_job_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_job_files_js ON sub_job_files(job_subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_sub_job_files_org ON sub_job_files(organization_id);

CREATE OR REPLACE FUNCTION s27_fill_org_from_js()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM job_subcontractors WHERE id = NEW.job_subcontractor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_org_from_js ON sub_job_files;
CREATE TRIGGER fill_org_from_js BEFORE INSERT ON sub_job_files
  FOR EACH ROW EXECUTE FUNCTION s27_fill_org_from_js();

DROP POLICY IF EXISTS "Org members manage sub job files" ON sub_job_files;
CREATE POLICY "Org members manage sub job files"
  ON sub_job_files FOR ALL TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

DROP POLICY IF EXISTS "Sub users read own job files" ON sub_job_files;
CREATE POLICY "Sub users read own job files"
  ON sub_job_files FOR SELECT TO authenticated
  USING (is_own_job_subcontractor(job_subcontractor_id));

DROP POLICY IF EXISTS "Sub users upload own job files" ON sub_job_files;
CREATE POLICY "Sub users upload own job files"
  ON sub_job_files FOR INSERT TO authenticated
  WITH CHECK (
    is_own_job_subcontractor(job_subcontractor_id)
    AND by_sub = true
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "Sub users delete own job files" ON sub_job_files;
CREATE POLICY "Sub users delete own job files"
  ON sub_job_files FOR DELETE TO authenticated
  USING (
    is_own_job_subcontractor(job_subcontractor_id)
    AND by_sub = true
    AND uploaded_by = auth.uid()
  );

-- ============================================================ přijaté faktury
ALTER TABLE received_invoices
  ADD COLUMN IF NOT EXISTS job_subcontractor_id uuid REFERENCES job_subcontractors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_received_invoices_js ON received_invoices(job_subcontractor_id)
  WHERE job_subcontractor_id IS NOT NULL;
