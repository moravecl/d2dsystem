/*
  # S21: Singleton nastavení per organizace (invoice_settings, company_info)

  `idx_invoice_settings_singleton` a `idx_company_info_singleton` vynucovaly
  JEDEN řádek nastavení pro celou databázi — pozůstatek z doby před
  multi-tenancy. Každá organizace potřebuje vlastní fakturační nastavení
  a firemní údaje; správný invariant je UNIQUE(organization_id).
*/

DROP INDEX IF EXISTS idx_invoice_settings_singleton;
DROP INDEX IF EXISTS idx_company_info_singleton;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_settings_org
  ON invoice_settings (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_info_org
  ON company_info (organization_id);
