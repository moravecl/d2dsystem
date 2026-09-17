/*
  # S30: Seznam materiálů pro portál subky jako v uživatelské sekci

  sub_list_materials nově vrací i řemeslo (trade) a řadí stejně jako
  číselník v administraci (trade, sort_order) — portál tak zobrazí
  stejný seznam jako uživatelská sekce, jen bez cen. Mění se návratový
  typ, proto je nutný DROP.
*/

DROP FUNCTION IF EXISTS sub_list_materials(uuid);

CREATE OR REPLACE FUNCTION sub_list_materials(p_job_sub uuid)
RETURNS TABLE (name text, unit text, trade text)
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
    SELECT m.name, m.unit, m.trade FROM materials m
    WHERE m.organization_id = v_js.organization_id
      AND m.is_active = true
    ORDER BY m.trade, m.sort_order, m.name;
END;
$$;
