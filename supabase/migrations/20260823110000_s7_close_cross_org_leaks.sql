/*
  # S7: Uzavření děr mezi organizacemi + konec sdíleného katalogu

  ## Problém (kritický)
  Audit živé DB (pg_policies) našel desítky politik, jejichž jedinou podmínkou
  je „uživatel je přihlášený" — bez vazby na organizaci i vlastnictví:

      invoices          UPDATE  (auth.uid() IS NOT NULL)
      received_invoice_items  SELECT/INSERT/UPDATE/DELETE  (auth.uid() IS NOT NULL)
      project_files     SELECT/INSERT/UPDATE/DELETE  (auth.uid() IS NOT NULL)
      attendance_records INSERT  (true)
      ... a další (CRM, servis, dokumenty, fotky, vady)

  Kterýkoli účet kterékoli organizace tak mohl číst/měnit/mazat data všech
  ostatních firem. Zároveň platí rozhodnutí: KATALOG NEBUDE SDÍLENÝ — products,
  categories, materials atd. přecházejí na per-org izolaci.

  ## Řešení (dynamické — nezávislé na neúplné složce migrací)
  Migrace projde pg_policies za běhu, najde každou PERMISSIVE politiku pro
  `authenticated`, která neodkazuje ani na organizaci, ani na vlastnictví
  řádku, a nahradí ji org-scoped verzí pod stejným názvem:

    - tabulka s organization_id / org_id  → přímý filtr na current_org_id()
    - dceřiná tabulka (project_id, client_id, invoice_id, ...) → přes rodiče
    - rodič bez org sloupce, ale s project_id → dvojskok přes projects
    - nic z toho → politika se NEmění, jen se vypíše NOTICE (ruční dořešení)

  Politiky, které původně vyžadovaly is_admin()/is_admin_or_manager(), dostanou
  navíc AND is_full_admin() — správa katalogu zůstává adminům, ale už jen nad
  vlastní organizací.

  Portál: portal_comments (čtení+vklad), project_files a project_documents
  (čtení, u files i update) dostanou větev is_portal_client_of_project(),
  protože klientský portál tyto tabulky používá přes rušené otevřené politiky.
  Ostatní portálové politiky jsou samostatné a migrace se jich nedotýká.

  Autofill: aplikace při insertech do katalogu organization_id NEposílá
  (ověřeno v ProductForm). Každá přepsaná tabulka s přímým org sloupcem proto
  dostane BEFORE INSERT trigger, který NULL doplní na current_org_id().

  ## Dále: úklid mrtvých omezení
  Na 4 tabulkách ležela vedle přísné (owner/admin/manager) politiky i stará
  volná „Org members can ..." — přes OR vyhrávala ta volná a omezení podle
  role bylo mrtvé. Volné duplikáty se ruší (12 politik).

  ## Po nasazení
  1. supabase/s7_backfill_org.sql  — přiřadí řádky s NULL org hlavní organizaci
  2. migrace S6 (20260823120000)   — vynucení datových oprávnění rolí
  3. supabase/verify_s6_permissions.sql

  Rollback: politiky nesou COMMENT 's7'; obnovit lze ze snímku pg_policies
  pořízeného před nasazením.
*/

-- ============================================================
-- 1. Helpery (identické definice sdílí i S6 — CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() LIMIT 1),
    (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION is_full_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND role = ANY (ARRAY['owner','admin'])
  );
$$;

REVOKE ALL ON FUNCTION current_org_id() FROM public;
REVOKE ALL ON FUNCTION is_full_admin() FROM public;
GRANT EXECUTE ON FUNCTION current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_full_admin() TO authenticated;

-- Autofill org sloupce při INSERTu (aplikace ho u katalogu neposílá)
CREATE OR REPLACE FUNCTION s7_fill_organization_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := current_org_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION s7_fill_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := current_org_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Úklid mrtvých omezení podle role (OR je dosud rušilo)
-- ============================================================
-- Pozn.: řadoví členové tím ztratí zápis do cashflow/rozpočtů —
-- přesně to přísnější politiky vždy zamýšlely.
DO $$
DECLARE p text; t text;
BEGIN
  FOREACH p IN ARRAY ARRAY[
    'cashflow_manual_entries|Org members can insert manual entries',
    'cashflow_manual_entries|Org members can update manual entries',
    'cashflow_manual_entries|Org members can delete manual entries',
    'cashflow_manual_entries|Org members can view manual entries',       -- duplicitní SELECT
    'cashflow_settings|Org members can insert cashflow settings',
    'cashflow_settings|Org members can update cashflow settings',
    'invoice_project_allocations|Org members can insert allocations',
    'invoice_project_allocations|Org members can update allocations',
    'invoice_project_allocations|Org members can delete allocations',
    'project_budgets|Org members can insert project budgets',
    'project_budgets|Org members can update project budgets',
    'project_budgets|Org members can delete project budgets'
  ] LOOP
    t := split_part(p, '|', 1);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', split_part(p, '|', 2), t);
    RAISE NOTICE 'S7 úklid: % / %', t, split_part(p, '|', 2);
  END LOOP;
END $$;

-- ============================================================
-- 3. Dynamické přepsání otevřených politik na org-scoped
-- ============================================================
DO $$
DECLARE
  r record;
  own_col text;          -- org sloupec samotné tabulky
  fk text;               -- FK sloupec na rodiče
  parent_tbl text;       -- rodičovská tabulka
  parent_col text;       -- org sloupec rodiče
  pred text;             -- výsledný predikát
  admin_intent boolean;  -- původní politika vyžadovala admina
  portal_fn boolean := to_regproc('is_portal_client_of_project') IS NOT NULL;
  add_portal boolean;
  skipped text[] := '{}';
  n int := 0;
BEGIN
  -- Snímek cílů předem (během smyčky se pg_policies mění)
  CREATE TEMP TABLE s7_targets ON COMMIT DROP AS
  SELECT tablename, policyname, cmd,
         coalesce(qual, '') || ' ' || coalesce(with_check, '') AS cond
  FROM pg_policies
  WHERE schemaname = 'public'
    AND permissive = 'PERMISSIVE'
    AND roles @> '{authenticated}'
    AND coalesce(qual, '') || ' ' || coalesce(with_check, '')
        !~ 'organization_id|org_id|organization_members|get_my_organization_id|current_org_id|is_portal_client|is_superadmin|user_has_org_access'
    AND coalesce(qual, '') || ' ' || coalesce(with_check, '')
        !~ 'auth\.uid\(\) =|= auth\.uid\(\)';

  FOR r IN SELECT * FROM s7_targets ORDER BY tablename, cmd, policyname LOOP
    admin_intent := r.cond ~ 'is_admin';

    -- a) přímý org sloupec
    SELECT column_name INTO own_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = r.tablename
      AND column_name IN ('organization_id', 'org_id')
    ORDER BY column_name LIMIT 1;

    IF own_col IS NOT NULL THEN
      pred := format('%I.%I = current_org_id()', r.tablename, own_col);
    ELSE
      -- b) odvození přes rodiče
      pred := NULL;
      FOR fk, parent_tbl IN
        SELECT * FROM (VALUES
          ('project_id',          'projects'),
          ('client_id',           'clients'),
          ('asset_id',            'assets'),
          ('invoice_id',          'invoices'),
          ('received_invoice_id', 'received_invoices'),
          ('ticket_id',           'service_tickets'),
          ('schedule_id',         'service_schedules'),
          ('quote_id',            'project_quotes'),
          ('heating_system_id',   'heating_systems'),
          ('template_id',         'room_templates'),
          ('product_id',          'products')
        ) v(c, p)
      LOOP
        CONTINUE WHEN NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = fk
        );
        SELECT column_name INTO parent_col
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = parent_tbl
          AND column_name IN ('organization_id', 'org_id')
        ORDER BY column_name LIMIT 1;

        IF parent_col IS NOT NULL THEN
          pred := format(
            'EXISTS (SELECT 1 FROM %I s7p WHERE s7p.id = %I.%I AND s7p.%I = current_org_id())',
            parent_tbl, r.tablename, fk, parent_col);
        ELSIF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = parent_tbl AND column_name = 'project_id'
        ) THEN
          -- dvojskok: rodič nemá org, ale má project_id
          pred := format(
            'EXISTS (SELECT 1 FROM %I s7p JOIN projects s7pj ON s7pj.id = s7p.project_id '
            'WHERE s7p.id = %I.%I AND s7pj.organization_id = current_org_id())',
            parent_tbl, r.tablename, fk);
        END IF;
        EXIT WHEN pred IS NOT NULL;
      END LOOP;
    END IF;

    IF pred IS NULL THEN
      skipped := skipped || format('%s / %s (%s)', r.tablename, r.policyname, r.cmd);
      CONTINUE;
    END IF;

    IF admin_intent THEN
      pred := '(' || pred || ') AND is_full_admin()';
    END IF;

    -- Portálová větev jen tam, kde portál dosud jel přes rušenou politiku
    add_portal := portal_fn AND (
         (r.tablename = 'portal_comments'   AND r.cmd IN ('SELECT', 'INSERT'))
      OR (r.tablename = 'project_files'     AND r.cmd IN ('SELECT', 'UPDATE'))
      OR (r.tablename = 'project_documents' AND r.cmd = 'SELECT')
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'project_id'
    );
    IF add_portal THEN
      pred := '(' || pred || format(') OR is_portal_client_of_project(%I.project_id)', r.tablename);
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    IF r.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (%s)',
                     r.policyname, r.tablename, pred);
    ELSIF r.cmd = 'SELECT' THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (%s)',
                     r.policyname, r.tablename, pred);
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (%s)',
                     r.policyname, r.tablename, pred);
    ELSE -- UPDATE i ALL
      EXECUTE format('CREATE POLICY %I ON %I FOR %s TO authenticated USING (%s) WITH CHECK (%s)',
                     r.policyname, r.tablename, r.cmd, pred, pred);
    END IF;
    EXECUTE format('COMMENT ON POLICY %I ON %I IS %L', r.policyname, r.tablename, 's7');

    -- autofill trigger pro přímý org sloupec
    IF own_col IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      WHERE c.relname = r.tablename AND tg.tgname = 's7_fill_org'
    ) THEN
      EXECUTE format('CREATE TRIGGER s7_fill_org BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION %I()',
                     r.tablename,
                     CASE own_col WHEN 'organization_id' THEN 's7_fill_organization_id' ELSE 's7_fill_org_id' END);
    END IF;

    n := n + 1;
    RAISE NOTICE 'S7: % [%] % -> %', r.tablename, r.cmd, r.policyname, pred;
  END LOOP;

  RAISE NOTICE 'S7: přepsáno % politik', n;
  IF array_length(skipped, 1) > 0 THEN
    RAISE NOTICE 'S7: RUČNĚ DOŘEŠIT (nenašel se org ani rodičovský sloupec): %',
                 array_to_string(skipped, '; ');
  END IF;
END $$;

/*
  POZNÁMKY
  1. Politiky vázané na vlastnictví (auth.uid() = user_id apod.) se nemění —
     pouštějí jen vlastní řádky, mezi organizacemi nic neprozradí.
  2. bathroom_symbols s org_id IS NULL (globální symboly) zůstávají čitelné —
     jejich politika odkazuje na org_id, filtr ji nezachytil. Po plném
     přechodu na per-org katalog zvaž přiřazení globálních symbolů organizaci.
  3. Mrtvé tabulky cashflow_sales_invoices a cashflow_vat_refunds (aplikace je
     nepoužívá) tato migrace neřeší — kandidáti na DROP v samostatném úklidu.
  4. Storage (bucket policies) je mimo public schéma — samostatná kontrola.
*/
