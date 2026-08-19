/*
  # S3: Org kontrola u zápisů do payments

  ## Problém (vysoký)
  SELECT na payments byl opraven už v 20260218204705 (scope přes invoices),
  ale INSERT/UPDATE/DELETE zůstaly jen na auth.uid() IS NOT NULL —
  libovolný přihlášený uživatel mohl vkládat, měnit a mazat platby
  cizích firem (invoice_id lze uhodnout/získat jinak).

  ## Oprava
  Všechny zápisy vázané na fakturu vlastní organizace, stejným vzorem
  jako opravený SELECT.
*/

DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON payments;

CREATE POLICY "Org members can insert payments"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can update payments"
  ON payments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.organization_id = get_my_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can delete payments"
  ON payments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.organization_id = get_my_organization_id()
    )
  );
