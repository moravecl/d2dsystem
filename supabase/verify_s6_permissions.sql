/*
  Ověření migrace S6 (20260823120000_s6_enforce_role_permissions_in_rls.sql)

  Spustit v SQL editoru Supabase PO nasazení migrace.
  Nic nemění — samé SELECTy.

  Rollback je v supabase/rollback_s6_permissions.sql.
*/

-- ============================================================
-- 0. NEJDŘÍV: snímek současného stavu politik
-- ============================================================
-- Tohle si ulož PŘED nasazením migrace. Je to jediný spolehlivý zdroj
-- pravdy o tom, jak RLS opravdu vypadá — složka migrations úplná není.
--
--   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- ============================================================
-- 1. Vznikly helper funkce?
-- ============================================================
SELECT
  p.proname AS funkce,
  pg_get_function_identity_arguments(p.oid) AS argumenty,
  p.prosecdef AS security_definer,
  p.provolatile = 's' AS stable
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('current_org_id','is_full_admin','is_portal_client_user',
                    'has_data_permission','has_module_permission')
ORDER BY p.proname;
-- Očekávání: 5 řádků, všechny security_definer = true a stable = true.

-- ============================================================
-- 2. Vznikly restriktivní politiky?
-- ============================================================
SELECT tablename, policyname, permissive, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 's6\_%'
ORDER BY tablename;
-- Očekávání: 20 řádků (nebo méně, pokud některé tabulky neexistují —
-- migrace to vypíše jako NOTICE). permissive musí být 'RESTRICTIVE'.

-- ============================================================
-- 3. Které tabulky ze seznamu v DB nejsou?
-- ============================================================
SELECT t.tbl AS chybejici_tabulka
FROM unnest(ARRAY[
  'invoices','invoice_items','invoice_document_links','payments',
  'received_invoices','received_invoice_items','received_invoice_attachments',
  'financial_entries','cash_transactions','fixed_costs','sales_invoices',
  'vat_refunds','invoice_project_allocations','cashflow_manual_entries',
  'cashflow_settings','project_budgets','bank_accounts','bank_transactions',
  'bank_transaction_matches','employee_contracts'
]) AS t(tbl)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = t.tbl
);
-- Očekávání: 0 řádků. Každý řádek = tabulka, která zůstala nechráněná.

-- ============================================================
-- 4. Kdo o co přijde — přehled rolí v organizaci
-- ============================================================
SELECT
  o.name AS organizace,
  cr.name AS role,
  count(ura.user_id) AS pocet_uzivatelu,
  coalesce((cr.permissions -> 'data' ->> 'view_invoices')::boolean, false)          AS vidi_faktury,
  coalesce((cr.permissions -> 'data' ->> 'view_financial_reports')::boolean, false) AS vidi_finance,
  coalesce((cr.permissions -> 'data' ->> 'view_salaries')::boolean, false)          AS vidi_mzdy
FROM custom_roles cr
JOIN organizations o ON o.id = cr.organization_id
LEFT JOIN user_role_assignments ura ON ura.role_id = cr.id
GROUP BY o.name, cr.name, cr.permissions
ORDER BY o.name, cr.name;
-- Projdi si to. Sloupce s `false` = uživatelé té role po nasazení
-- přestanou dané tabulky vidět. Přesně to je záměr — ale ověř,
-- že tam nemáš roli, které to omylem uřízne běžnou práci.

-- ============================================================
-- 5. Uživatelé bez přiřazené role
-- ============================================================
SELECT
  p.email,
  om.role AS org_role,
  p.role  AS profil_role,
  CASE
    WHEN p.role = 'admin' OR om.role IN ('owner','admin') THEN 'plný přístup (admin)'
    ELSE 'ŽÁDNÁ citlivá data'
  END AS pristup_po_S6
FROM profiles p
LEFT JOIN organization_members om ON om.user_id = p.id
LEFT JOIN user_role_assignments ura ON ura.user_id = p.id
WHERE ura.id IS NULL
  AND coalesce(p.is_portal_client, false) = false
ORDER BY pristup_po_S6, p.email;
-- Uživatelé bez role a bez adminství přijdou o všechna citlivá data.
-- Pokud tu někdo je, komu to vadí, přiřaď mu roli PŘED nasazením.

-- ============================================================
-- 6. Test za konkrétního uživatele (skutečné ověření)
-- ============================================================
-- Nahraď UUID a spusť celý blok najednou.
-- Simuluje požadavek přes PostgREST včetně RLS.

/*
BEGIN;
  -- set_config, ne SET LOCAL: nazev GUC ma dve tecky, coz syntaxe SET nezvlada.
  -- Poradi je zavazne — nejdriv claims, teprve pak prepnuti role.
  SELECT set_config('request.jwt.claims',
                    '{"sub":"SEM-UUID-UZIVATELE","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  SELECT
    auth.uid()                                   AS uzivatel,
    current_org_id()                             AS organizace,
    is_full_admin()                              AS je_admin,
    is_portal_client_user()                      AS je_portal,
    has_data_permission('view_invoices')         AS vidi_faktury,
    has_data_permission('view_financial_reports') AS vidi_finance,
    has_data_permission('view_salaries')          AS vidi_mzdy;

  -- Kolik řádků uživatel reálně uvidí:
  SELECT 'invoices'          AS tabulka, count(*) FROM invoices
  UNION ALL SELECT 'received_invoices',  count(*) FROM received_invoices
  UNION ALL SELECT 'financial_entries',  count(*) FROM financial_entries
  UNION ALL SELECT 'cash_transactions',  count(*) FROM cash_transactions
  UNION ALL SELECT 'employee_contracts', count(*) FROM employee_contracts;
ROLLBACK;
*/

-- Otestuj takhle minimálně tři účty:
--   a) majitele/admina        -> musí vidět všechno
--   b) omezenou roli          -> musí vidět 0 řádků v tabulkách bez oprávnění
--   c) účet klientského portálu -> musí vidět stejně jako před migrací

-- ============================================================
-- 7. Dopad na výkon
-- ============================================================
-- has_data_permission() je STABLE s konstantním argumentem, takže se
-- vyhodnotí jednou za dotaz, ne pro každý řádek. Ověř to:
--
--   EXPLAIN ANALYZE SELECT * FROM invoices LIMIT 100;
--
-- V plánu má být "One-Time Filter", ne volání funkce v každém řádku.
