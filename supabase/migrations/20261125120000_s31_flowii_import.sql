/*
  # S31: Import dat z jiného systému (Flowii) — idempotence

  - `import_ref` na importovaných tabulkách: identifikátor řádku ve zdrojovém
    systému (např. `flowii:zakazka:24188`). Unikátní per organizace, takže
    opakovaný import stejnou zálohu jen aktualizuje, nic nezduplikuje
    (upsert ON CONFLICT (organization_id, import_ref)). Řádky bez import_ref
    (NULL) unikátnost neomezuje.
  - `projects.legacy_number`: číslo zakázky ze starého systému (odkazují se
    na něj faktury, úkoly i události) a `projects.tech_details` jsonb pro
    technická pole zakázky (typ měření, střídač, panely, stavy NZU/ČEZ…).
*/

ALTER TABLE clients                 ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE client_contacts         ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE client_addresses        ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE suppliers               ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE projects                ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE leads                   ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE tasks                   ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE events                  ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE invoices                ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE received_invoices       ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE products                ADD COLUMN IF NOT EXISTS import_ref text;
ALTER TABLE cashflow_manual_entries ADD COLUMN IF NOT EXISTS import_ref text;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS legacy_number text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tech_details jsonb;

-- plné (ne částečné) unikátní indexy: PostgREST upsert umí odvodit jen ty;
-- NULL hodnoty se v unikátním indexu neporovnávají, běžné řádky neomezí
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_import_ref           ON clients (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_client_contacts_import_ref   ON client_contacts (client_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_client_addresses_import_ref  ON client_addresses (client_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_import_ref         ON suppliers (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_import_ref          ON projects (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_import_ref             ON leads (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_import_ref             ON tasks (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_import_ref            ON events (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_import_ref          ON invoices (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_received_invoices_import_ref ON received_invoices (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_import_ref          ON products (organization_id, import_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cashflow_manual_import_ref   ON cashflow_manual_entries (org_id, import_ref);

CREATE INDEX IF NOT EXISTS idx_projects_legacy_number ON projects (organization_id, legacy_number)
  WHERE legacy_number IS NOT NULL;
