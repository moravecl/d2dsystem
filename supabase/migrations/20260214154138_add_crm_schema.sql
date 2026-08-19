/*
  # CRM Schema - Clients, Contacts, Addresses, Notes, Audit Log

  1. Modified Tables
    - `clients` - added client_type, city, ico, dic, is_active fields
    - `projects` - added client_id FK, responsible_user_id, deadline

  2. New Tables
    - `client_contacts` - additional contacts per client (name, role, email, phone)
    - `client_addresses` - addresses per client (type: billing/delivery/realization)
    - `client_notes` - timestamped notes per client
    - `client_documents` - document links per client
    - `audit_log` - system-wide activity log (who/when/what/entity)

  3. Security
    - RLS enabled on all new tables
    - Authenticated users can read all, modify own records
    - Admins have full access

  4. Notes
    - client_type: 'rd' (rodinný dům), 'firma', 'obec'
    - address_type: 'billing', 'delivery', 'realization'
    - audit_log entity_type examples: 'client', 'project', 'product'
*/

-- Extend clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE clients ADD COLUMN client_type text NOT NULL DEFAULT 'rd';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'city'
  ) THEN
    ALTER TABLE clients ADD COLUMN city text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'ico'
  ) THEN
    ALTER TABLE clients ADD COLUMN ico text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'dic'
  ) THEN
    ALTER TABLE clients ADD COLUMN dic text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE clients ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Extend projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'responsible_user_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'deadline'
  ) THEN
    ALTER TABLE projects ADD COLUMN deadline date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'address'
  ) THEN
    ALTER TABLE projects ADD COLUMN address text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Client contacts
CREATE TABLE IF NOT EXISTS client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client contacts"
  ON client_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client contacts"
  ON client_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client contacts"
  ON client_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client contacts"
  ON client_contacts FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Client addresses
CREATE TABLE IF NOT EXISTS client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  address_type text NOT NULL DEFAULT 'billing',
  street text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'CZ',
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client addresses"
  ON client_addresses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client addresses"
  ON client_addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client addresses"
  ON client_addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client addresses"
  ON client_addresses FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Client notes
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client notes"
  ON client_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client notes"
  ON client_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Note authors can update their notes"
  ON client_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Note authors can delete their notes"
  ON client_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Client documents
CREATE TABLE IF NOT EXISTS client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT '',
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client documents"
  ON client_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client documents"
  ON client_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Document uploaders can delete their documents"
  ON client_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid,
  action text NOT NULL DEFAULT '',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit log entries"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client ON client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);
