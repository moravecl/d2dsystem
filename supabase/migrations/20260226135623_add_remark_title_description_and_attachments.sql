/*
  # Add title, description, and attachments to project remarks

  1. Modified Tables
    - `project_remarks`
      - `title` (text) - short summary/name of the remark
      - `description` (text) - detailed description (optional)

  2. New Tables
    - `project_remark_attachments`
      - `id` (uuid, primary key)
      - `remark_id` (uuid, FK to project_remarks)
      - `file_name` (text) - original file name
      - `file_url` (text) - storage URL
      - `file_size` (integer) - size in bytes
      - `content_type` (text) - MIME type
      - `uploaded_by` (uuid) - who uploaded
      - `uploaded_by_portal` (boolean)
      - `organization_id` (uuid)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on project_remark_attachments
    - Org members can CRUD attachments
    - Portal clients can read and insert attachments on their projects
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_remarks' AND column_name = 'title'
  ) THEN
    ALTER TABLE project_remarks ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_remarks' AND column_name = 'description'
  ) THEN
    ALTER TABLE project_remarks ADD COLUMN description text NOT NULL DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_remark_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remark_id uuid NOT NULL REFERENCES project_remarks(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_size integer NOT NULL DEFAULT 0,
  content_type text NOT NULL DEFAULT '',
  uploaded_by uuid,
  uploaded_by_portal boolean NOT NULL DEFAULT false,
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_remark_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read remark attachments"
  ON project_remark_attachments FOR SELECT TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Org members can insert remark attachments"
  ON project_remark_attachments FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "Org members can delete remark attachments"
  ON project_remark_attachments FOR DELETE TO authenticated
  USING (organization_id = get_my_organization_id());

CREATE POLICY "Portal clients can read attachments on their project remarks"
  ON project_remark_attachments FOR SELECT TO authenticated
  USING (is_portal_client_of_remark(remark_id));

CREATE POLICY "Portal clients can insert attachments on their project remarks"
  ON project_remark_attachments FOR INSERT TO authenticated
  WITH CHECK (is_portal_client_of_remark(remark_id));

CREATE OR REPLACE FUNCTION set_remark_attachment_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT pr.organization_id FROM project_remarks pr WHERE pr.id = NEW.remark_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_remark_attachment_org_id ON project_remark_attachments;
CREATE TRIGGER trg_set_remark_attachment_org_id
  BEFORE INSERT ON project_remark_attachments
  FOR EACH ROW
  EXECUTE FUNCTION set_remark_attachment_org_id();
