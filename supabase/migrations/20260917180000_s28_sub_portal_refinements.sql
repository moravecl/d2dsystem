/*
  # S28: Doladění portálu subdodavatelů dle zpětné vazby

  1. Sdílení souborů přes SLOŽKY projektu: project_folders.subs_visible —
     stejný princip jako portal_visible pro klienta. Subdodavatel na
     zakázce vidí obsah označených složek (read-only), žádné ruční kopírování.
  2. job_subcontractors.project_id (backfill z jobs + trigger) — portál
     potřebuje projekt kvůli složkám a harmonogramu, aniž by četl jobs.
  3. Výkaz práce časově OD–DO (nová signatura sub_log_work).
  4. RPC sub_list_materials — seznam materiálů organizace BEZ CEN pro
     výkaz materiálu v portálu (stejný číselník jako u uživatele systému).
*/

-- ============================================================ 1) složky pro subky
ALTER TABLE project_folders ADD COLUMN IF NOT EXISTS subs_visible boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Subcontractors read shared folders" ON project_folders;
CREATE POLICY "Subcontractors read shared folders"
  ON project_folders FOR SELECT TO authenticated
  USING (subs_visible = true AND is_sub_on_project(project_id));

DROP POLICY IF EXISTS "Subcontractors read files in shared folders" ON project_files;
CREATE POLICY "Subcontractors read files in shared folders"
  ON project_files FOR SELECT TO authenticated
  USING (
    is_sub_on_project(project_id)
    AND EXISTS (
      SELECT 1 FROM project_folders f
      WHERE f.id = project_files.folder_id AND f.subs_visible = true
    )
  );

-- ============================================================ 2) project_id na přiřazení
ALTER TABLE job_subcontractors ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

UPDATE job_subcontractors js SET project_id = j.project_id
FROM jobs j WHERE j.id = js.job_id AND js.project_id IS NULL;

CREATE OR REPLACE FUNCTION s28_fill_project_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    SELECT project_id INTO NEW.project_id FROM jobs WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_project_from_job ON job_subcontractors;
CREATE TRIGGER fill_project_from_job BEFORE INSERT ON job_subcontractors
  FOR EACH ROW EXECUTE FUNCTION s28_fill_project_from_job();

-- ============================================================ 3) výkaz práce od–do
DROP FUNCTION IF EXISTS sub_log_work(uuid, date, numeric, text);

CREATE OR REPLACE FUNCTION sub_log_work(
  p_job_sub uuid,
  p_date date,
  p_from time,
  p_to time,
  p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_js job_subcontractors;
  v_sub_name text;
  v_minutes int;
BEGIN
  SELECT * INTO v_js FROM job_subcontractors WHERE id = p_job_sub;
  IF v_js IS NULL OR v_js.subcontractor_id IS DISTINCT FROM current_subcontractor_id() THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;
  IF v_js.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Zakázka je uzavřená';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'Čas „do" musí být později než čas „od"';
  END IF;
  v_minutes := EXTRACT(EPOCH FROM (p_to - p_from))::int / 60;

  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_js.subcontractor_id;

  INSERT INTO job_worklogs (job_id, user_id, activity, started_at, ended_at, duration_minutes, note,
                            is_running, submitted_by_sub, approval_status)
  VALUES (v_js.job_id, auth.uid(),
          'Subdodávka — ' || COALESCE(v_sub_name, ''),
          (p_date + p_from)::timestamptz, (p_date + p_to)::timestamptz, v_minutes, COALESCE(p_note, ''),
          false, v_js.subcontractor_id, 'pending');

  PERFORM notify_org_users(
    v_js.organization_id, ARRAY['owner','admin','manager','employee'],
    'sub_worklog', 'Subdodavatel vykázal práci',
    COALESCE(v_sub_name, '') || ' — ' || to_char(p_date, 'DD.MM.YYYY') || ' '
      || to_char(p_from, 'HH24:MI') || '–' || to_char(p_to, 'HH24:MI'),
    'job_subcontractor', v_js.id, '/subdodavatele', 'sub_worklog', NULL
  );
  RETURN 'ok';
END;
$$;

-- ============================================================ 4) seznam materiálů bez cen
CREATE OR REPLACE FUNCTION sub_list_materials(p_job_sub uuid)
RETURNS TABLE (name text, unit text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_js job_subcontractors;
BEGIN
  SELECT * INTO v_js FROM job_subcontractors WHERE id = p_job_sub;
  IF v_js IS NULL OR v_js.subcontractor_id IS DISTINCT FROM current_subcontractor_id() THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;
  RETURN QUERY
    SELECT m.name, m.unit FROM materials m
    WHERE m.organization_id = v_js.organization_id
    ORDER BY m.name;
END;
$$;
