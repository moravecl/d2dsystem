/*
  # Inquiry Forms & Leads

  1. New Tables
    - `inquiry_forms`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `name` (text) - internal name for the form
      - `description` (text) - internal description
      - `fields` (jsonb) - array of field definitions [{label, type, required}]
      - `settings` (jsonb) - form settings (colors, redirect URL, success message, etc.)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `leads`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `inquiry_form_id` (uuid, FK to inquiry_forms, nullable)
      - `name` (text) - contact name
      - `email` (text) - contact email
      - `phone` (text) - contact phone
      - `message` (text) - message / notes
      - `source` (text) - where the lead came from
      - `form_data` (jsonb) - raw submitted data
      - `status` (text) - new / contacted / qualified / converted / lost
      - `converted_project_id` (uuid, nullable, FK to projects)
      - `converted_client_id` (uuid, nullable, FK to clients)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on both tables
    - inquiry_forms: org members can CRUD their own org's forms
    - leads: org members can CRUD their own org's leads
    - leads INSERT is also allowed for anon role (public form submissions via edge function use service role)
*/

CREATE TABLE IF NOT EXISTS inquiry_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[
    {"key":"name","label":"Jméno a příjmení","type":"text","required":true},
    {"key":"email","label":"E-mail","type":"email","required":true},
    {"key":"phone","label":"Telefon","type":"tel","required":false},
    {"key":"message","label":"Zpráva","type":"textarea","required":false}
  ]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{
    "primary_color":"#2563eb",
    "success_message":"Děkujeme za Vaši poptávku! Brzy se Vám ozveme.",
    "submit_label":"Odeslat poptávku",
    "title":"Poptávkový formulář"
  }'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inquiry_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view own inquiry forms"
  ON inquiry_forms FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = inquiry_forms.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert inquiry forms"
  ON inquiry_forms FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = inquiry_forms.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update inquiry forms"
  ON inquiry_forms FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = inquiry_forms.organization_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = inquiry_forms.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete inquiry forms"
  ON inquiry_forms FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = inquiry_forms.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  inquiry_form_id uuid REFERENCES inquiry_forms(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'web_form',
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',
  converted_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  converted_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view own leads"
  ON leads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = leads.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert leads"
  ON leads FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = leads.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update leads"
  ON leads FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = leads.organization_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = leads.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete leads"
  ON leads FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = leads.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_inquiry_forms_org ON inquiry_forms(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_form ON leads(inquiry_form_id);
