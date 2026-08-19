/*
  # Service Workflow Schema - Complete Ticket to Invoice Flow

  This migration implements a comprehensive service workflow:
  Ticket -> Service -> Report -> Protocol -> Billing -> Invoice

  1. Modified Tables
    - `service_schedules`
      - `workflow_status` (text) - Workflow state: new, scheduled, confirmed, en_route, on_site, awaiting_report, report_completed, protocol_created, to_bill, invoiced, closed
      - `service_category` (text) - Type: warranty, out_of_warranty, claim, service_contract, paid_visit
      - `source_ticket_id` (uuid) - Link to source ticket
      - `client_name` (text) - Customer name
      - `problem_description` (text) - Description of the issue
      - `technician_ids` (uuid[]) - Assigned technicians
      - `confirmed_at` (timestamptz) - When customer confirmed
      - `started_at` (timestamptz) - When service started
      - `completed_at` (timestamptz) - When service completed
      - `report_required` (boolean) - Whether report is mandatory

    - `service_tickets`
      - `linked_service_id` (uuid) - Link to created service schedule
      - `ticket_status` (text) - Enhanced status: new, in_progress, waiting_customer, requires_visit, converted_to_service, resolved_remote, closed

  2. New Tables
    - `service_reports` - Detailed work reports for services
      - Contains all work, material, travel data
      - Linked to service_schedules
      - Has locking mechanism
      - Tracks protocol/invoice generation status

    - `service_report_items` - Line items for reports
      - Work entries
      - Materials
      - Travel
      - Custom items

  3. Security
    - RLS enabled on all tables
    - Org-scoped access
*/

-- Add workflow fields to service_schedules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'workflow_status'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN workflow_status text NOT NULL DEFAULT 'new';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'service_category'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN service_category text NOT NULL DEFAULT 'paid_visit';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'source_ticket_id'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN source_ticket_id uuid REFERENCES service_tickets(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN client_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'problem_description'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN problem_description text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'technician_ids'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN technician_ids uuid[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'report_required'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN report_required boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add linked_service_id to service_tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_tickets' AND column_name = 'linked_service_id'
  ) THEN
    ALTER TABLE service_tickets ADD COLUMN linked_service_id uuid REFERENCES service_schedules(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_tickets' AND column_name = 'ticket_status'
  ) THEN
    ALTER TABLE service_tickets ADD COLUMN ticket_status text NOT NULL DEFAULT 'new';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_schedules_workflow_status ON service_schedules(workflow_status);
CREATE INDEX IF NOT EXISTS idx_service_schedules_source_ticket ON service_schedules(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_linked_service ON service_tickets(linked_service_id);

-- Service Reports table
CREATE TABLE IF NOT EXISTS service_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES service_schedules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  arrival_at timestamptz,
  departure_at timestamptz,
  work_minutes integer NOT NULL DEFAULT 0,
  travel_km numeric(10,2) NOT NULL DEFAULT 0,
  labor_rate numeric(10,2) NOT NULL DEFAULT 0,
  travel_rate numeric(10,2) NOT NULL DEFAULT 0,
  labor_total numeric(12,2) NOT NULL DEFAULT 0,
  travel_total numeric(12,2) NOT NULL DEFAULT 0,
  materials_total numeric(12,2) NOT NULL DEFAULT 0,
  other_costs_total numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'none',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  work_description text NOT NULL DEFAULT '',
  findings text NOT NULL DEFAULT '',
  recommendation text NOT NULL DEFAULT '',
  internal_note text NOT NULL DEFAULT '',
  customer_note text NOT NULL DEFAULT '',
  signed_by_customer text NOT NULL DEFAULT '',
  customer_signature_data text,
  signed_at timestamptz,
  locked_at timestamptz,
  protocol_generated_at timestamptz,
  protocol_id uuid,
  billing_transferred_at timestamptz,
  billing_id uuid,
  protocol_stale boolean NOT NULL DEFAULT false,
  billing_stale boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_reports_schedule ON service_reports(schedule_id);
CREATE INDEX IF NOT EXISTS idx_service_reports_org ON service_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_service_reports_status ON service_reports(status);

-- Service Report Items table
CREATE TABLE IF NOT EXISTS service_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES service_reports(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'work',
  description text NOT NULL DEFAULT '',
  quantity numeric(10,3) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ks',
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  purchase_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  worker_id uuid REFERENCES auth.users(id),
  worker_name text NOT NULL DEFAULT '',
  hours numeric(6,2) NOT NULL DEFAULT 0,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  work_date date,
  product_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_report_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_report_items_report ON service_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_service_report_items_type ON service_report_items(item_type);

-- RLS Policies for service_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_reports' AND policyname = 'Users can read own org service reports'
  ) THEN
    CREATE POLICY "Users can read own org service reports"
      ON service_reports FOR SELECT
      TO authenticated
      USING (
        org_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_reports' AND policyname = 'Users can insert service reports in own org'
  ) THEN
    CREATE POLICY "Users can insert service reports in own org"
      ON service_reports FOR INSERT
      TO authenticated
      WITH CHECK (
        org_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        AND created_by = auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_reports' AND policyname = 'Users can update own org service reports'
  ) THEN
    CREATE POLICY "Users can update own org service reports"
      ON service_reports FOR UPDATE
      TO authenticated
      USING (
        org_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        org_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_reports' AND policyname = 'Users can delete own org service reports'
  ) THEN
    CREATE POLICY "Users can delete own org service reports"
      ON service_reports FOR DELETE
      TO authenticated
      USING (
        org_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        AND locked_at IS NULL
      );
  END IF;
END $$;

-- RLS Policies for service_report_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_report_items' AND policyname = 'Users can read service report items'
  ) THEN
    CREATE POLICY "Users can read service report items"
      ON service_report_items FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM service_reports sr
          WHERE sr.id = service_report_items.report_id
          AND sr.org_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_report_items' AND policyname = 'Users can insert service report items'
  ) THEN
    CREATE POLICY "Users can insert service report items"
      ON service_report_items FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM service_reports sr
          WHERE sr.id = service_report_items.report_id
          AND sr.org_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
          )
          AND sr.locked_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_report_items' AND policyname = 'Users can update service report items'
  ) THEN
    CREATE POLICY "Users can update service report items"
      ON service_report_items FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM service_reports sr
          WHERE sr.id = service_report_items.report_id
          AND sr.org_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
          )
          AND sr.locked_at IS NULL
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM service_reports sr
          WHERE sr.id = service_report_items.report_id
          AND sr.org_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
          )
          AND sr.locked_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_report_items' AND policyname = 'Users can delete service report items'
  ) THEN
    CREATE POLICY "Users can delete service report items"
      ON service_report_items FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM service_reports sr
          WHERE sr.id = service_report_items.report_id
          AND sr.org_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
          )
          AND sr.locked_at IS NULL
        )
      );
  END IF;
END $$;

-- Trigger to auto-set org_id on service_reports insert
CREATE OR REPLACE FUNCTION set_service_report_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT ss.org_id INTO NEW.org_id
    FROM service_schedules ss
    WHERE ss.id = NEW.schedule_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_service_report_org_id ON service_reports;
CREATE TRIGGER trigger_set_service_report_org_id
  BEFORE INSERT ON service_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_service_report_org_id();

-- Trigger to mark protocol/billing as stale when report is updated
CREATE OR REPLACE FUNCTION mark_report_dependents_stale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.locked_at IS NULL AND (OLD.locked_at IS NOT NULL OR OLD.protocol_generated_at IS NOT NULL OR OLD.billing_transferred_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  IF NEW.protocol_generated_at IS NOT NULL AND OLD.protocol_generated_at IS NOT NULL THEN
    NEW.protocol_stale := true;
  END IF;

  IF NEW.billing_transferred_at IS NOT NULL AND OLD.billing_transferred_at IS NOT NULL THEN
    NEW.billing_stale := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mark_report_dependents_stale ON service_reports;
CREATE TRIGGER trigger_mark_report_dependents_stale
  BEFORE UPDATE ON service_reports
  FOR EACH ROW
  WHEN (
    OLD.work_description IS DISTINCT FROM NEW.work_description
    OR OLD.findings IS DISTINCT FROM NEW.findings
    OR OLD.recommendation IS DISTINCT FROM NEW.recommendation
    OR OLD.labor_total IS DISTINCT FROM NEW.labor_total
    OR OLD.materials_total IS DISTINCT FROM NEW.materials_total
    OR OLD.travel_total IS DISTINCT FROM NEW.travel_total
    OR OLD.total_price IS DISTINCT FROM NEW.total_price
  )
  EXECUTE FUNCTION mark_report_dependents_stale();

-- Add comments for documentation
COMMENT ON TABLE service_reports IS 'Detailed work reports for service visits - mandatory step before protocol/billing';
COMMENT ON TABLE service_report_items IS 'Line items (work, material, travel, other) for service reports';

COMMENT ON COLUMN service_schedules.workflow_status IS 'Workflow state: new, scheduled, confirmed, en_route, on_site, awaiting_report, report_completed, protocol_created, to_bill, invoiced, closed';
COMMENT ON COLUMN service_schedules.service_category IS 'Service type: warranty, out_of_warranty, claim, service_contract, paid_visit';
COMMENT ON COLUMN service_schedules.source_ticket_id IS 'Link to original support ticket if converted from ticket';

COMMENT ON COLUMN service_reports.status IS 'Report status: draft, completed, locked';
COMMENT ON COLUMN service_reports.protocol_stale IS 'True if report changed after protocol was generated';
COMMENT ON COLUMN service_reports.billing_stale IS 'True if report changed after billing was transferred';
