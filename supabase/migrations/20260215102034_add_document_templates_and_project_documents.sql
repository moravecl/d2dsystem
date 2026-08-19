/*
  # Document Templates & Project Documents

  1. New Tables
    - `document_templates`
      - `id` (uuid, primary key)
      - `name` (text) - template name
      - `description` (text) - short description
      - `template_type` (text) - one of: zapis_stavba, predavaci_protokol, servisni_protokol, checklist, obecny
      - `content` (text) - HTML template with {{placeholder}} syntax
      - `version` (integer) - version number, increments on update
      - `is_active` (boolean) - whether template is available for use
      - `created_by` (uuid) - admin who created it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `project_documents`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `template_id` (uuid, FK to document_templates, nullable)
      - `template_version` (integer) - version of template used
      - `name` (text) - document name
      - `status` (text) - DRAFT or FINAL
      - `rendered_html` (text) - current HTML content
      - `render_context` (jsonb) - which entities were used to populate placeholders
      - `document_type` (text) - same enum as template_type, or 'upload' for uploaded files
      - `file_url` (text, nullable) - for uploaded files
      - `file_type` (text, nullable) - mime type for uploads
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - document_templates: authenticated admins can CRUD, all authenticated can SELECT active ones
    - project_documents: authenticated users can CRUD their project documents
*/

CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  template_type text NOT NULL DEFAULT 'obecny',
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_template_type CHECK (template_type IN ('zapis_stavba', 'predavaci_protokol', 'servisni_protokol', 'checklist', 'obecny'))
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates"
  ON document_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can view active templates"
  ON document_templates FOR SELECT
  TO authenticated
  USING (is_active = true);


CREATE TABLE IF NOT EXISTS project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  template_id uuid REFERENCES document_templates(id),
  template_version integer,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  rendered_html text NOT NULL DEFAULT '',
  render_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_type text NOT NULL DEFAULT 'obecny',
  file_url text,
  file_type text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_doc_status CHECK (status IN ('DRAFT', 'FINAL')),
  CONSTRAINT valid_doc_type CHECK (document_type IN ('zapis_stavba', 'predavaci_protokol', 'servisni_protokol', 'checklist', 'obecny', 'upload'))
);

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project documents"
  ON project_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert project documents"
  ON project_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update own project documents"
  ON project_documents FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update any project document"
  ON project_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can delete own draft documents"
  ON project_documents FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() AND status = 'DRAFT'
  );

CREATE POLICY "Admins can delete any draft document"
  ON project_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    AND status = 'DRAFT'
  );

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_template_id ON project_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(template_type);
