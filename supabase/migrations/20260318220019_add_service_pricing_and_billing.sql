/*
  # Add Service Pricing and Billing Fields

  1. Changes to `service_schedules`
    - `agreed_price` (numeric) - Price agreed with customer when scheduling
    - `final_price` (numeric) - Actual price after service completion
    - `price_change_note` (text) - Explanation if final differs from agreed
    - `billing_status` (text) - Tracks invoicing workflow: not_ready, ready_for_invoicing, invoiced
    - `finance_source_type` (text) - Type identifier for finance system integration
    - `finance_source_id` (uuid) - Reference to finance record when transferred
    - `transferred_to_finance_at` (timestamptz) - When transferred to finance
    - `transferred_to_finance_by` (uuid) - Who transferred to finance

  2. Purpose
    - Enable pricing workflow for service schedules similar to quick jobs
    - Track billing status from scheduling through invoicing
    - Integrate with existing finance/billing system
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'agreed_price'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN agreed_price numeric(12,2) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'final_price'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN final_price numeric(12,2) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'price_change_note'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN price_change_note text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'billing_status'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN billing_status text NOT NULL DEFAULT 'not_ready';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'finance_source_type'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN finance_source_type text DEFAULT 'service_schedule';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'finance_source_id'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN finance_source_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'transferred_to_finance_at'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN transferred_to_finance_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_schedules' AND column_name = 'transferred_to_finance_by'
  ) THEN
    ALTER TABLE service_schedules ADD COLUMN transferred_to_finance_by uuid NULL REFERENCES auth.users(id);
  END IF;
END $$;

COMMENT ON COLUMN service_schedules.agreed_price IS 'Price agreed with customer when scheduling the service';
COMMENT ON COLUMN service_schedules.final_price IS 'Actual final price after service completion';
COMMENT ON COLUMN service_schedules.price_change_note IS 'Explanation if final price differs from agreed price';
COMMENT ON COLUMN service_schedules.billing_status IS 'Billing workflow status: not_ready, ready_for_invoicing, invoiced';
COMMENT ON COLUMN service_schedules.finance_source_type IS 'Type identifier for finance system (service_schedule)';
COMMENT ON COLUMN service_schedules.finance_source_id IS 'Reference to finance record when transferred';
COMMENT ON COLUMN service_schedules.transferred_to_finance_at IS 'Timestamp when transferred to finance module';
COMMENT ON COLUMN service_schedules.transferred_to_finance_by IS 'User who transferred to finance module';
