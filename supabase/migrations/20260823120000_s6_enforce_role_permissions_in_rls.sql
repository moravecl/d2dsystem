/*
  # S6: Serverové vynucení rolí a oprávnění (fáze 1 – citlivá čtení)

  ## Problém (kritický)
  Systém rolí (custom_roles.permissions → modules/data) se do teď vynucoval
  výhradně v prohlížeči. Žádná RLS politika neodkazovala na custom_roles ani
  user_role_assignments — RLS byla pouze org-scoped.

  Důsledek: uživatel s rolí, která má view_invoices = false, si data přesto
  přečetl přímo přes PostgREST se svým vlastním JWT:
      GET /rest/v1/invoices?select=*
  Klientské přepínače v UI byly jen kosmetika.

  ## Řešení
  1. SQL helpery, které zrcadlí logiku hooku usePermissions:
       is_full_admin()            – profiles.role='admin' NEBO org role owner/admin
       is_portal_client_user()    – účet klientského portálu (nemá org roli)
       has_data_permission(key)   – čtení custom_roles.permissions->'data'->>key
       has_module_permission(key) – totéž pro 'modules', včetně fallbacku
  2. RESTRICTIVE politiky na citlivé tabulky.

  ## Proč RESTRICTIVE a ne přepsání stávajících politik
  Běžná (PERMISSIVE) politika se s ostatními slučuje přes OR — přidání další
  by přístup jen rozšířilo. RESTRICTIVE se naopak přidává přes AND, takže se
  vrství NAD cokoli, co už na tabulce je, aniž bychom museli stávající politiky
  znát nebo rušit.

  To je tady podstatné: historie migrací v repozitáři NENÍ úplná (např.
  financial_entries se v ní nikdy nezakládá, jen se na ni sahá), takže
  deklarovaný stav politik nelze z repozitáře spolehlivě odvodit. Tenhle
  přístup na tom nezávisí.

  ## Co tato migrace ZÁMĚRNĚ neřeší (viz poznámky na konci)
  - Maskování jednotlivých sloupců (products.purchase_price, margin_percent)
  - Zápisová oprávnění (edit_*, delete_*, approve_quotes, manage_*)
  - Modulová oprávnění jako hlídka na úrovni dat
*/

-- ============================================================
-- 1. Helpery
-- ============================================================

-- Organizace přihlášeného uživatele.
--
-- Záměrně NEpoužíváme stávající get_my_organization_id(), která čte jen
-- profiles.organization_id. Klient (OrganizationContext) bere org primárně
-- z organization_members a na profil padá až jako na záložní zdroj:
--     memberResult.data?.organization_id ?? profile?.organization_id
-- Kdybychom to tady zrcadlili jinak, uživatel s prázdným profiles.organization_id
-- by v UI org měl, ale RLS by mu ji nepřiznala — a přišel by o přístup k datům,
-- na která má nárok.
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() LIMIT 1),
    (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );
$$;

-- Plný přístup: globální admin, nebo owner/admin své organizace.
-- Zrcadlí `isFullAdmin` v src/hooks/usePermissions.ts.
--
-- Členství se schválně neváže na current_org_id(): uživatel má v tomhle
-- systému právě jedno členství (OrganizationContext čte .maybeSingle()),
-- takže navázání navíc nic nepřidá a jen by přineslo riziko, že se admin
-- kvůli nekonzistentnímu profilu zamkne ven.
CREATE OR REPLACE FUNCTION is_full_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND role = ANY (ARRAY['owner','admin'])
  );
$$;

-- Účet klientského portálu. Nemá org roli ani přiřazenou custom_role, takže by
-- ho kontrola oprávnění jinak vždy zamítla. Portálové politiky (is_portal_client_of_project
-- apod.) si přístup hlídají samy, tady je proto z restriktivní vrstvy vyjímáme.
CREATE OR REPLACE FUNCTION is_portal_client_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_portal_client FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Datové oprávnění přihlášeného uživatele.
-- Bez přiřazené role vrací false — shodně s klientským fallbackem, který
-- všechna data_permissions nastavuje na false.
CREATE OR REPLACE FUNCTION has_data_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN is_full_admin() THEN true
    ELSE COALESCE(
      (
        SELECT (cr.permissions -> 'data' ->> p_key)::boolean
        FROM user_role_assignments ura
        JOIN custom_roles cr ON cr.id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND ura.organization_id = current_org_id()
        LIMIT 1
      ),
      false
    )
  END;
$$;

-- Modulové oprávnění. Bez přiřazené role platí stejný fallback jako v UI:
-- dashboard, projekty, ukoly, kalendar, znalosti, nastenka.
-- Zatím se nikde nepoužívá v politice — je připravené pro fázi 2.
CREATE OR REPLACE FUNCTION has_module_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN is_full_admin() THEN true
    WHEN NOT EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
        AND organization_id = current_org_id()
    ) THEN p_key = ANY (ARRAY['dashboard','projekty','ukoly','kalendar','znalosti','nastenka'])
    ELSE COALESCE(
      (
        SELECT (cr.permissions -> 'modules' ->> p_key)::boolean
        FROM user_role_assignments ura
        JOIN custom_roles cr ON cr.id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND ura.organization_id = current_org_id()
        LIMIT 1
      ),
      false
    )
  END;
$$;

REVOKE ALL ON FUNCTION current_org_id() FROM public;
REVOKE ALL ON FUNCTION is_full_admin() FROM public;
REVOKE ALL ON FUNCTION is_portal_client_user() FROM public;
REVOKE ALL ON FUNCTION has_data_permission(text) FROM public;
REVOKE ALL ON FUNCTION has_module_permission(text) FROM public;
GRANT EXECUTE ON FUNCTION current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_full_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_portal_client_user() TO authenticated;
GRANT EXECUTE ON FUNCTION has_data_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION has_module_permission(text) TO authenticated;

-- ============================================================
-- 2. Restriktivní vrstva na citlivá čtení
-- ============================================================
-- Každá tabulka dostane jednu RESTRICTIVE SELECT politiku. Ta se přes AND
-- přidá ke všem stávajícím politikám: kdo dosud data neviděl, neuvidí je ani
-- teď; kdo je viděl, musí navíc mít příslušné oprávnění.
--
-- Zápis (INSERT/UPDATE/DELETE) tahle migrace nechává být — omezovat ho je
-- fáze 2 a vyžaduje projít každý zápisový tok v aplikaci.

DO $$
DECLARE
  rec record;
  -- Seznam ověřený proti skutečné databázi (information_schema), ne proti
  -- složce migrations — ta je neúplná.
  mapping constant text[][] := ARRAY[
    -- Vydané faktury a platby
    ['invoices',                       'view_invoices'],
    ['invoice_items',                  'view_invoices'],
    ['invoice_document_links',         'view_invoices'],
    ['payments',                       'view_invoices'],
    -- Přijaté faktury
    ['received_invoices',              'view_invoices'],
    ['received_invoice_items',         'view_invoices'],
    ['received_invoice_attachments',   'view_invoices'],
    -- Finanční přehledy a cashflow
    ['financial_entries',              'view_financial_reports'],
    ['cash_transactions',              'view_financial_reports'],
    ['fixed_costs',                    'view_financial_reports'],
    ['sales_invoices',                 'view_financial_reports'],
    ['vat_refunds',                    'view_financial_reports'],
    ['invoice_project_allocations',    'view_financial_reports'],
    ['cashflow_manual_entries',        'view_financial_reports'],
    ['cashflow_settings',              'view_financial_reports'],
    ['project_budgets',                'view_financial_reports'],
    -- Banka
    ['bank_accounts',                  'view_financial_reports'],
    ['bank_transactions',              'view_financial_reports'],
    ['bank_transaction_matches',       'view_financial_reports'],
    -- Mzdové údaje
    ['employee_contracts',             'view_salaries']
  ];
  tbl text;
  perm text;
  policy_name text;
  i int;
BEGIN
  FOR i IN 1 .. array_length(mapping, 1) LOOP
    tbl  := mapping[i][1];
    perm := mapping[i][2];
    policy_name := 's6_require_' || perm;

    SELECT * INTO rec
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = tbl;

    IF NOT FOUND THEN
      RAISE NOTICE 'S6: tabulka % neexistuje, přeskakuji', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR SELECT TO authenticated '
      'USING (is_portal_client_user() OR has_data_permission(%L))',
      policy_name, tbl, perm
    );

    RAISE NOTICE 'S6: % -> vyžaduje %', tbl, perm;
  END LOOP;
END $$;

-- ============================================================
-- 3. Indexy pro helper funkce
-- ============================================================
-- has_data_permission() se volá pro každý řádek každého dotazu na chráněné
-- tabulky. Bez indexu je z toho seq scan na user_role_assignments.
CREATE INDEX IF NOT EXISTS idx_ura_user_org
  ON user_role_assignments (user_id, organization_id);

-- ============================================================
-- POZNÁMKY – co zůstává nedořešené
-- ============================================================
/*
  1. SLOUPCOVÁ OPRÁVNĚNÍ
     view_purchase_prices a view_margins se týkají sloupců
     products.purchase_price a products.margin_percent, ne celých řádků.
     RLS pracuje na úrovni řádků, takže je takhle vynutit nelze. Řešení je buď
     view (products_safe se sloupci přes CASE WHEN has_data_permission(...)),
     nebo GRANT na jednotlivé sloupce. První varianta znamená přepsat všechny
     klientské dotazy z 'products' na 'products_safe'.

     Do té doby zůstávají tato dvě oprávnění pouze klientská.

  2. ZÁPISOVÁ OPRÁVNĚNÍ
     edit_projects, delete_projects, edit_clients, delete_clients,
     edit_products, edit_quotes, approve_quotes, manage_* — všechna zatím
     zůstávají pouze klientská. Restriktivní politiky pro INSERT/UPDATE/DELETE
     se dají doplnit stejným vzorem, ale každý zápisový tok je potřeba nejdřív
     projít, aby se nerozbily servisní a portálové operace.

  3. TABULKY ZÁMĚRNĚ VYNECHANÉ
     - invoice_settings: konfigurace číselných řad. Omezit čtení by mohlo
       rozbít přidělování čísel faktur; stránka je stejně jen pro adminy.
     - cashflow_sales_invoices, cashflow_vat_refunds: v databázi existují,
       ale aplikace je nikde nepoužívá (0 výskytů ve zdrojácích) — pracuje
       se sales_invoices a vat_refunds. Vypadá to na pozůstatek přejmenování.
       Chránit mrtvou tabulku nemá smysl; patří ke smazání, ne k zabezpečení.
     - employees: obsahuje hourly_rate, ale používá ji WorkerPicker při
       vyplňování zakázek. Omezení celé tabulky by rozbilo běžný provoz.
       Její stávající politika (is_admin OR user_id = auth.uid()) je navíc
       už teď přiměřeně těsná.
     - time_entries: potřebuje ji docházka a evidence času pro vlastní
       záznamy uživatele.
     - warehouse_transactions: potřebuje ji skladový provoz.

  4. ZNÁMÁ HRANIČNÍ SITUACE
     src/components/cashflow/SalesInvoiceModal.tsx dělá
         INSERT ... .select('id').single()
     Restriktivní politika se týká jen SELECTu, ale klauzule RETURNING je
     SELECT taky. Uživatel bez view_financial_reports by tedy fakturu založil
     a teprve návratová hodnota by skončila chybou. V praxi by takový uživatel
     prodejní faktury zakládat neměl — správně to vyřeší až omezení zápisu
     ve fázi 2. Do té doby je to jediné známé místo, kde se S6 může projevit
     jako chyba místo prázdného výsledku.

  5. SYNCHRONIZACE S KLIENTEM
     has_data_permission() zrcadlí src/hooks/usePermissions.ts. Když se změní
     jedno, musí se změnit i druhé:
       - is_full_admin()  <-> isFullAdmin
       - current_org_id() <-> OrganizationContext (members-first, profil jako fallback)
       - fallback bez role <-> větev `if (!assignment?.role_id)`

  6. OVĚŘENÍ PO NASAZENÍ – viz supabase/verify_s6_permissions.sql
     ROLLBACK                 – viz supabase/rollback_s6_permissions.sql
*/
