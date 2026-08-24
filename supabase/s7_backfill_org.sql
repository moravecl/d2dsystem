/*
  S7 backfill: přiřazení řádků s NULL organizací hlavní organizaci

  Po S7 jsou řádky bez organization_id/org_id neviditelné (katalog býval
  globální, takže jich může být hodně). Tento skript je přiřadí organizaci
  uživatele admin@housesmart.cz.

  Spustit PO migraci S7. Nejdřív sekci A (náhled), pak sekci B (zápis).
*/

-- ============================================================
-- A. NÁHLED — kolik řádků kde chybí (nic nemění)
-- ============================================================
DO $$
DECLARE r record; cnt bigint;
BEGIN
  FOR r IN
    SELECT t.table_name, c.column_name
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('organization_id', 'org_id')
      AND t.table_name NOT IN (
        'bathroom_symbols',          -- NULL = globální symbol (záměr)
        'element_category_colors',   -- NULL = globální barvy (záměr)
        'organizations', 'organization_members', 'profiles',
        'cashflow_sales_invoices', 'cashflow_vat_refunds'  -- mrtvé tabulky
      )
    ORDER BY t.table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I IS NULL', r.table_name, r.column_name)
    INTO cnt;
    IF cnt > 0 THEN
      RAISE NOTICE 'NULL org: % . % -> % řádků', r.table_name, r.column_name, cnt;
    END IF;
  END LOOP;
  RAISE NOTICE 'Náhled hotov. Pokud čísla sedí, spusť sekci B.';
END $$;

-- ============================================================
-- B. ZÁPIS — odkomentuj a spusť
-- ============================================================
/*
DO $$
DECLARE
  target uuid;
  r record;
  cnt bigint;
  total bigint := 0;
BEGIN
  SELECT om.organization_id INTO target
  FROM organization_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE u.email = 'admin@housesmart.cz'
  LIMIT 1;

  IF target IS NULL THEN
    RAISE EXCEPTION 'Organizace pro admin@housesmart.cz nenalezena';
  END IF;
  RAISE NOTICE 'Cílová organizace: %', target;

  FOR r IN
    SELECT t.table_name, c.column_name
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('organization_id', 'org_id')
      AND t.table_name NOT IN (
        'bathroom_symbols', 'element_category_colors',
        'organizations', 'organization_members', 'profiles',
        'cashflow_sales_invoices', 'cashflow_vat_refunds'
      )
    ORDER BY t.table_name
  LOOP
    EXECUTE format('UPDATE %I SET %I = $1 WHERE %I IS NULL',
                   r.table_name, r.column_name, r.column_name)
    USING target;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    IF cnt > 0 THEN
      total := total + cnt;
      RAISE NOTICE 'Backfill: % -> % řádků', r.table_name, cnt;
    END IF;
  END LOOP;
  RAISE NOTICE 'Celkem přiřazeno % řádků', total;
END $$;
*/
