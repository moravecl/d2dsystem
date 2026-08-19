/*
  # Cashflow Module Schema (v2 - idempotent)

  Creates all cashflow-related tables with IF NOT EXISTS guards and
  DROP/CREATE POLICY pattern for idempotency.
*/

-- ============================================================
-- project_budgets
-- ============================================================
CREATE TABLE IF NOT EXISTS project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Rozpočet',
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE project_budgets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_budgets' AND policyname='Org members can view project budgets') THEN
    CREATE POLICY "Org members can view project budgets" ON project_budgets FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_budgets' AND policyname='Org members can insert project budgets') THEN
    CREATE POLICY "Org members can insert project budgets" ON project_budgets FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_budgets' AND policyname='Org members can update project budgets') THEN
    CREATE POLICY "Org members can update project budgets" ON project_budgets FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_budgets' AND policyname='Org members can delete project budgets') THEN
    CREATE POLICY "Org members can delete project budgets" ON project_budgets FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_budgets_org ON project_budgets(org_id);

CREATE OR REPLACE FUNCTION update_project_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_budgets_updated_at ON project_budgets;
CREATE TRIGGER trg_project_budgets_updated_at
  BEFORE UPDATE ON project_budgets FOR EACH ROW EXECUTE FUNCTION update_project_budgets_updated_at();

-- ============================================================
-- sales_invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_date date,
  amount_gross numeric(14,2) NOT NULL DEFAULT 0,
  amount_net numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'canceled')),
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_invoices' AND policyname='Org members can view sales invoices') THEN
    CREATE POLICY "Org members can view sales invoices" ON sales_invoices FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_invoices' AND policyname='Org members can insert sales invoices') THEN
    CREATE POLICY "Org members can insert sales invoices" ON sales_invoices FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_invoices' AND policyname='Org members can update sales invoices') THEN
    CREATE POLICY "Org members can update sales invoices" ON sales_invoices FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_invoices' AND policyname='Org members can delete sales invoices') THEN
    CREATE POLICY "Org members can delete sales invoices" ON sales_invoices FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_org ON sales_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_project ON sales_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_due ON sales_invoices(due_date);

CREATE OR REPLACE FUNCTION update_sales_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_invoices_updated_at ON sales_invoices;
CREATE TRIGGER trg_sales_invoices_updated_at
  BEFORE UPDATE ON sales_invoices FOR EACH ROW EXECUTE FUNCTION update_sales_invoices_updated_at();

-- ============================================================
-- invoice_project_allocations
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_project_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sales_invoice_id uuid NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  allocated_amount_gross numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_allocation_invoice_project UNIQUE (org_id, sales_invoice_id, project_id)
);

ALTER TABLE invoice_project_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_project_allocations' AND policyname='Org members can view allocations') THEN
    CREATE POLICY "Org members can view allocations" ON invoice_project_allocations FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_project_allocations' AND policyname='Org members can insert allocations') THEN
    CREATE POLICY "Org members can insert allocations" ON invoice_project_allocations FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_project_allocations' AND policyname='Org members can update allocations') THEN
    CREATE POLICY "Org members can update allocations" ON invoice_project_allocations FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_project_allocations' AND policyname='Org members can delete allocations') THEN
    CREATE POLICY "Org members can delete allocations" ON invoice_project_allocations FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON invoice_project_allocations(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_allocations_project ON invoice_project_allocations(project_id);

-- ============================================================
-- cashflow_manual_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS cashflow_manual_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT 'in' CHECK (type IN ('in', 'out')),
  amount_gross numeric(14,2) NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  note text,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cashflow_manual_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashflow_manual_entries' AND policyname='Org members can view manual entries') THEN
    CREATE POLICY "Org members can view manual entries" ON cashflow_manual_entries FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashflow_manual_entries' AND policyname='Org members can insert manual entries') THEN
    CREATE POLICY "Org members can insert manual entries" ON cashflow_manual_entries FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashflow_manual_entries' AND policyname='Org members can update manual entries') THEN
    CREATE POLICY "Org members can update manual entries" ON cashflow_manual_entries FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashflow_manual_entries' AND policyname='Org members can delete manual entries') THEN
    CREATE POLICY "Org members can delete manual entries" ON cashflow_manual_entries FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cashflow_manual_org ON cashflow_manual_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_manual_date ON cashflow_manual_entries(date);

-- ============================================================
-- vat_refunds
-- ============================================================
CREATE TABLE IF NOT EXISTS vat_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount_gross numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vat_refunds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vat_refunds' AND policyname='Org members can view vat refunds') THEN
    CREATE POLICY "Org members can view vat refunds" ON vat_refunds FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vat_refunds' AND policyname='Org members can insert vat refunds') THEN
    CREATE POLICY "Org members can insert vat refunds" ON vat_refunds FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vat_refunds' AND policyname='Org members can update vat refunds') THEN
    CREATE POLICY "Org members can update vat refunds" ON vat_refunds FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vat_refunds' AND policyname='Org members can delete vat refunds') THEN
    CREATE POLICY "Org members can delete vat refunds" ON vat_refunds FOR DELETE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vat_refunds_org ON vat_refunds(org_id);

-- ============================================================
-- cashflow_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS cashflow_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  granularity text NOT NULL DEFAULT 'month' CHECK (granularity IN ('month', 'week')),
  default_payment_terms_days integer NOT NULL DEFAULT 14,
  sort_invoices_by text NOT NULL DEFAULT 'due_date' CHECK (sort_invoices_by IN ('due_date', 'issue_date')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cashflow_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashflow_settings' AND policyname='Org members can view cashflow settings') THEN
    CREATE POLICY "Org members can view cashflow settings" ON cashflow_settings FOR SELECT TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashflow_settings' AND policyname='Org members can insert cashflow settings') THEN
    CREATE POLICY "Org members can insert cashflow settings" ON cashflow_settings FOR INSERT TO authenticated
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashflow_settings' AND policyname='Org members can update cashflow settings') THEN
    CREATE POLICY "Org members can update cashflow settings" ON cashflow_settings FOR UPDATE TO authenticated
      USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_cashflow_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cashflow_settings_updated_at ON cashflow_settings;
CREATE TRIGGER trg_cashflow_settings_updated_at
  BEFORE UPDATE ON cashflow_settings FOR EACH ROW EXECUTE FUNCTION update_cashflow_settings_updated_at();
