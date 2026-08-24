/*
  Rollback migrace S6 (20260823120000_s6_enforce_role_permissions_in_rls.sql)

  Spustit, pokud po nasazení někdo přijde o přístup, který mít má.
  Vrátí stav do bodu před migrací: shodí restriktivní politiky a nechá
  na tabulkách jen ty původní.

  Helper funkce se schválně NEmažou — nic nerozbíjejí a po opravě
  konfigurace rolí se hodí. Pokud je chceš pryč taky, odkomentuj sekci 2.
*/

-- ============================================================
-- 1. Shodit restriktivní politiky
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 's6\_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    RAISE NOTICE 'Odstraněna politika % na %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- Kontrola: musí vrátit 0 řádků
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 's6\_%';

-- ============================================================
-- 2. Volitelně: odstranit i helper funkce
-- ============================================================
/*
DROP FUNCTION IF EXISTS has_module_permission(text);
DROP FUNCTION IF EXISTS has_data_permission(text);
DROP FUNCTION IF EXISTS is_portal_client_user();
DROP FUNCTION IF EXISTS is_full_admin();
DROP FUNCTION IF EXISTS current_org_id();
*/

-- ============================================================
-- 3. Částečný rollback
-- ============================================================
-- Když dělá problém jen jedna tabulka, nemaž všechno — shoď jen ji:
--
--   DROP POLICY IF EXISTS "s6_require_view_invoices" ON invoices;
--
-- Lepší postup je ale obvykle opravit konfiguraci role:
--
--   UPDATE custom_roles
--   SET permissions = jsonb_set(permissions, '{data,view_invoices}', 'true')
--   WHERE id = '...';
