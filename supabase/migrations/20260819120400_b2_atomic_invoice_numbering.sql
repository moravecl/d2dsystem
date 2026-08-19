/*
  # B2 + B4: Atomické číslování faktur s ročním resetem

  ## Problém
  Číslo dokladu se generovalo na klientovi z načtených invoice_settings a čítač
  se inkrementoval samostatným UPDATE — dva uživatelé mohli vystavit doklady
  se stejným číslem (B2). Nastavení reset_yearly / current_year se navíc
  úplně ignorovalo (B4).

  ## Oprava
  Funkce allocate_invoice_number(p_type) provede v jedné transakci:
  1. zamkne řádek invoice_settings vlastní organizace (FOR UPDATE)
  2. při reset_yearly a přelomu roku vynuluje čítače a nastaví current_year
  3. vrátí naformátované číslo dokladu a čítač atomicky posune

  SECURITY DEFINER se scope přísně na organizaci volajícího
  (get_my_organization_id()) — běžný uživatel tak může alokovat číslo,
  i když RLS na invoice_settings povoluje UPDATE jen adminům.
*/

CREATE OR REPLACE FUNCTION allocate_invoice_number(p_type text DEFAULT 'standard')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_row invoice_settings%ROWTYPE;
  v_prefix text;
  v_next integer;
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_number text;
  v_next_col text;
BEGIN
  v_org := get_my_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Uživatel nemá organizaci';
  END IF;

  SELECT * INTO v_row
  FROM invoice_settings
  WHERE organization_id = v_org
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nastavení fakturace nenalezeno';
  END IF;

  -- B4: roční reset čítačů
  IF COALESCE(v_row.reset_yearly, false) AND COALESCE(v_row.current_year, v_year) <> v_year THEN
    UPDATE invoice_settings SET
      next_number = 1,
      next_number_deposit_invoice = 1,
      next_number_tax_document = 1,
      next_number_credit_note = 1,
      next_number_settlement_invoice = 1,
      next_number_cash_receipt = 1,
      current_year = v_year,
      updated_at = now()
    WHERE id = v_row.id;
    SELECT * INTO v_row FROM invoice_settings WHERE id = v_row.id;
  ELSIF COALESCE(v_row.current_year, 0) <> v_year THEN
    UPDATE invoice_settings SET current_year = v_year, updated_at = now()
    WHERE id = v_row.id;
  END IF;

  CASE p_type
    WHEN 'deposit_invoice' THEN
      v_prefix := COALESCE(v_row.prefix_deposit_invoice, 'ZF');
      v_next := COALESCE(v_row.next_number_deposit_invoice, 1);
      v_next_col := 'next_number_deposit_invoice';
    WHEN 'tax_document' THEN
      v_prefix := COALESCE(v_row.prefix_tax_document, 'DD');
      v_next := COALESCE(v_row.next_number_tax_document, 1);
      v_next_col := 'next_number_tax_document';
    WHEN 'credit_note' THEN
      v_prefix := COALESCE(v_row.prefix_credit_note, 'D');
      v_next := COALESCE(v_row.next_number_credit_note, 1);
      v_next_col := 'next_number_credit_note';
    WHEN 'settlement_invoice' THEN
      v_prefix := COALESCE(v_row.prefix_settlement_invoice, 'VF');
      v_next := COALESCE(v_row.next_number_settlement_invoice, 1);
      v_next_col := 'next_number_settlement_invoice';
    WHEN 'cash_receipt' THEN
      v_prefix := COALESCE(v_row.prefix_cash_receipt, 'PPD');
      v_next := COALESCE(v_row.next_number_cash_receipt, 1);
      v_next_col := 'next_number_cash_receipt';
    ELSE
      v_prefix := COALESCE(v_row.prefix_standard, v_row.number_prefix, 'FV');
      v_next := COALESCE(v_row.next_number, 1);
      v_next_col := 'next_number';
  END CASE;

  v_number := v_row.number_format;
  v_number := replace(v_number, '{PREFIX}', v_prefix);
  v_number := replace(v_number, '{YYYY}', v_year::text);
  v_number := replace(v_number, '{NNN}', lpad(v_next::text, 3, '0'));
  v_number := replace(v_number, '{NN}', lpad(v_next::text, 2, '0'));

  EXECUTE format(
    'UPDATE invoice_settings SET %I = $1, updated_at = now() WHERE id = $2',
    v_next_col
  ) USING v_next + 1, v_row.id;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION allocate_invoice_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION allocate_invoice_number(text) TO authenticated;
