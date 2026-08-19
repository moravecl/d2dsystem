/*
  # Asset Management Module

  1. New Tables
    - `assets` - Universal asset registry (vehicles, appliances, buildings, tools)
      - `id` (uuid, primary key)
      - `asset_type` (text) - vehicle, appliance, building, tool
      - `name` (text) - display name
      - `code` (text) - internal identifier / registration
      - `tags` (text[]) - searchable labels
      - `owner_type` (text) - company or client
      - `client_id` (uuid, nullable, FK to clients)
      - `project_id` (uuid, nullable, FK to projects) - originating project
      - `building_id` (uuid, nullable, self-ref) - parent building for appliances
      - `location_address` (text) - physical address
      - `location_room` (text) - room/floor
      - `manufacturer` (text)
      - `model` (text)
      - `serial_number` (text)
      - `purchase_date` (date)
      - `supplier` (text)
      - `warranty_until` (date, nullable)
      - `warranty_terms` (text)
      - `note` (text)
      - `status` (text) - active, inactive, disposed
      - Vehicle-specific: vin, license_plate, fuel_type, odometer_km
      - Appliance-specific: device_type (FVE, battery, wallbox, rekuperace, TC, kotel, rozvadec, spotrebic)
      - Building-specific: building_type (rd, firma, obec), main_breaker, connection_type, heating_type, has_fve, has_recuperation
      - `is_active` (boolean)
      - `created_by` (uuid)
      - `created_at`, `updated_at`

    - `asset_events` - Service history, damages, inspections
      - `id` (uuid, primary key)
      - `asset_id` (uuid, FK to assets)
      - `event_type` (text) - service, revision, damage, insurance, warranty_claim, stk, calibration, filter_change, other
      - `title` (text)
      - `description` (text)
      - `event_date` (date)
      - `odometer_km` (integer, nullable) - reading at time of event
      - `motor_hours` (integer, nullable)
      - `cost` (numeric)
      - `supplier` (text)
      - `document_url` (text, nullable) - attached PDF/photo
      - `performed_by` (uuid, nullable)
      - `created_by` (uuid)
      - `created_at`

    - `due_items` - Tracked deadlines and recurring intervals
      - `id` (uuid, primary key)
      - `asset_id` (uuid, FK to assets)
      - `due_type` (text) - revision, service, warranty, insurance, stk, emission, vignette, calibration, filter_change, other
      - `label` (text) - human-readable description
      - `due_date` (date, nullable)
      - `due_km` (integer, nullable)
      - `due_motor_hours` (integer, nullable)
      - `interval_months` (integer, nullable)
      - `interval_km` (integer, nullable)
      - `status` (text) - ok, upcoming, overdue, completed
      - `responsible_user_id` (uuid, nullable)
      - `notify` (boolean) - flag for notification eligibility
      - `completed_at` (timestamptz, nullable)
      - `completed_by` (uuid, nullable)
      - `created_by` (uuid)
      - `created_at`, `updated_at`

    - `asset_documents` - File attachments per asset
      - `id` (uuid, primary key)
      - `asset_id` (uuid, FK to assets)
      - `name` (text)
      - `file_url` (text)
      - `file_type` (text)
      - `uploaded_by` (uuid)
      - `created_at`

  2. Security
    - RLS enabled on all tables
    - Authenticated users can read all assets
    - Authenticated users can insert/update
    - Only admins or creators can delete

  3. Indexes
    - asset_type, client_id, building_id on assets
    - asset_id on events, due_items, documents
    - due_date + status on due_items for deadline queries
*/

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL DEFAULT 'appliance',
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  owner_type text NOT NULL DEFAULT 'company',
  client_id uuid REFERENCES clients(id),
  project_id uuid REFERENCES projects(id),
  building_id uuid,
  location_address text NOT NULL DEFAULT '',
  location_room text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  purchase_date date,
  supplier text NOT NULL DEFAULT '',
  warranty_until date,
  warranty_terms text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',

  -- Vehicle fields
  vin text NOT NULL DEFAULT '',
  license_plate text NOT NULL DEFAULT '',
  fuel_type text NOT NULL DEFAULT '',
  odometer_km integer NOT NULL DEFAULT 0,

  -- Appliance fields
  device_type text NOT NULL DEFAULT '',

  -- Building fields
  building_type text NOT NULL DEFAULT '',
  main_breaker text NOT NULL DEFAULT '',
  connection_type text NOT NULL DEFAULT '',
  heating_type text NOT NULL DEFAULT '',
  has_fve boolean NOT NULL DEFAULT false,
  has_recuperation boolean NOT NULL DEFAULT false,

  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_asset_type CHECK (asset_type IN ('vehicle', 'appliance', 'building', 'tool')),
  CONSTRAINT valid_owner_type CHECK (owner_type IN ('company', 'client')),
  CONSTRAINT valid_asset_status CHECK (status IN ('active', 'inactive', 'disposed'))
);

ALTER TABLE assets ADD CONSTRAINT fk_assets_building FOREIGN KEY (building_id) REFERENCES assets(id);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assets"
  ON assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Authenticated users can insert assets"
  ON assets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Authenticated users can update assets"
  ON assets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admins can delete assets"
  ON assets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));


-- Asset Events table
CREATE TABLE IF NOT EXISTS asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  event_type text NOT NULL DEFAULT 'service',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  odometer_km integer,
  motor_hours integer,
  cost numeric NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT '',
  document_url text,
  performed_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_event_type CHECK (event_type IN ('service', 'revision', 'damage', 'insurance', 'warranty_claim', 'stk', 'calibration', 'filter_change', 'other'))
);

ALTER TABLE asset_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view asset events"
  ON asset_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Authenticated users can insert asset events"
  ON asset_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Authenticated users can update own asset events"
  ON asset_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update any asset event"
  ON asset_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can delete asset events"
  ON asset_events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));


-- Due Items table
CREATE TABLE IF NOT EXISTS due_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  due_type text NOT NULL DEFAULT 'revision',
  label text NOT NULL,
  due_date date,
  due_km integer,
  due_motor_hours integer,
  interval_months integer,
  interval_km integer,
  status text NOT NULL DEFAULT 'ok',
  responsible_user_id uuid REFERENCES auth.users(id),
  notify boolean NOT NULL DEFAULT true,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_due_type CHECK (due_type IN ('revision', 'service', 'warranty', 'insurance', 'stk', 'emission', 'vignette', 'calibration', 'filter_change', 'other')),
  CONSTRAINT valid_due_status CHECK (status IN ('ok', 'upcoming', 'overdue', 'completed'))
);

ALTER TABLE due_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view due items"
  ON due_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Authenticated users can insert due items"
  ON due_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Authenticated users can update due items"
  ON due_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admins can delete due items"
  ON due_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));


-- Asset Documents table
CREATE TABLE IF NOT EXISTS asset_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT '',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE asset_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view asset documents"
  ON asset_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Authenticated users can insert asset documents"
  ON asset_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Admins can delete asset documents"
  ON asset_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));


-- Indexes
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_client ON assets(client_id);
CREATE INDEX IF NOT EXISTS idx_assets_building ON assets(building_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_asset_events_asset ON asset_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_events_date ON asset_events(event_date);
CREATE INDEX IF NOT EXISTS idx_due_items_asset ON due_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_due_items_date_status ON due_items(due_date, status);
CREATE INDEX IF NOT EXISTS idx_due_items_status ON due_items(status);
CREATE INDEX IF NOT EXISTS idx_asset_documents_asset ON asset_documents(asset_id);
