/*
  # Auto-populate organization_id on INSERT via triggers

  ## Problem
  Application code inserts rows without organization_id.
  RLS WITH CHECK requires organization_id = get_my_organization_id(),
  so inserts fail or go to wrong org.

  ## Fix
  Add BEFORE INSERT triggers on all org-scoped tables that auto-set
  organization_id from the current user's org membership when NULL.
*/

CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_my_organization_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Helper to create trigger if not exists
CREATE OR REPLACE FUNCTION create_org_trigger(tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS set_org_id ON %I;
     CREATE TRIGGER set_org_id
       BEFORE INSERT ON %I
       FOR EACH ROW EXECUTE FUNCTION set_organization_id();',
    tbl, tbl
  );
END;
$$;

SELECT create_org_trigger('projects');
SELECT create_org_trigger('clients');
SELECT create_org_trigger('products');
SELECT create_org_trigger('categories');
SELECT create_org_trigger('subcategories');
SELECT create_org_trigger('design_modules');
SELECT create_org_trigger('design_presets');
SELECT create_org_trigger('inspirations');
SELECT create_org_trigger('heating_systems');
SELECT create_org_trigger('materials');
SELECT create_org_trigger('lighting_norms');
SELECT create_org_trigger('document_templates');
SELECT create_org_trigger('email_templates');
SELECT create_org_trigger('invoice_settings');
SELECT create_org_trigger('system_settings');
SELECT create_org_trigger('company_info');
SELECT create_org_trigger('assets');
SELECT create_org_trigger('invoices');
SELECT create_org_trigger('received_invoices');
SELECT create_org_trigger('financial_entries');
SELECT create_org_trigger('suppliers');
SELECT create_org_trigger('service_schedules');
SELECT create_org_trigger('service_tickets');
SELECT create_org_trigger('tasks');
SELECT create_org_trigger('time_entries');
SELECT create_org_trigger('warehouse_items');
SELECT create_org_trigger('viceprace');
SELECT create_org_trigger('jobs');
SELECT create_org_trigger('attendance_records');
SELECT create_org_trigger('smtp_accounts');
SELECT create_org_trigger('employees');

DROP FUNCTION create_org_trigger(text);
