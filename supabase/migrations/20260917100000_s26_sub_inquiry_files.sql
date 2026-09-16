/*
  # S26: Přílohy poptávek a nabídek subdodavatelů

  - `sub_inquiry_files`: soubory k poptávce (recipient_id NULL — nahrává
    org, vidí všichni oslovení) a soubory k nabídce (recipient_id vyplněn —
    nahrává subdodavatel, vidí on a org).
  - Soubory fyzicky v bucketu `uploads` (authenticated upload, public read
    — stejně jako přijaté faktury a portálové připomínky).
  - organization_id plní trigger ODVOZENÍM z poptávky (portálový uživatel
    nemá current_org_id() — vzor s14_fill_org_from_project).
*/

CREATE TABLE IF NOT EXISTS sub_inquiry_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  inquiry_id uuid NOT NULL REFERENCES sub_inquiries(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES sub_inquiry_recipients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sub_inquiry_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_inquiry_files_inq ON sub_inquiry_files(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_sub_inquiry_files_rec ON sub_inquiry_files(recipient_id);
CREATE INDEX IF NOT EXISTS idx_sub_inquiry_files_org ON sub_inquiry_files(organization_id);

CREATE OR REPLACE FUNCTION s26_fill_org_from_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM sub_inquiries WHERE id = NEW.inquiry_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_org_from_inquiry ON sub_inquiry_files;
CREATE TRIGGER fill_org_from_inquiry BEFORE INSERT ON sub_inquiry_files
  FOR EACH ROW EXECUTE FUNCTION s26_fill_org_from_inquiry();

CREATE OR REPLACE FUNCTION is_own_sub_recipient(p_recipient uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_inquiry_recipients r
    WHERE r.id = p_recipient
      AND r.subcontractor_id = current_subcontractor_id()
  );
$$;

CREATE OR REPLACE FUNCTION is_sub_inquiry_open(p_inquiry uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sub_inquiries WHERE id = p_inquiry AND status = 'sent'
  );
$$;

DROP POLICY IF EXISTS "Org members manage sub inquiry files" ON sub_inquiry_files;
CREATE POLICY "Org members manage sub inquiry files"
  ON sub_inquiry_files FOR ALL TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

DROP POLICY IF EXISTS "Sub users read inquiry and own files" ON sub_inquiry_files;
CREATE POLICY "Sub users read inquiry and own files"
  ON sub_inquiry_files FOR SELECT TO authenticated
  USING (
    (recipient_id IS NULL AND is_sub_recipient_of_inquiry(inquiry_id))
    OR (recipient_id IS NOT NULL AND is_own_sub_recipient(recipient_id))
  );

DROP POLICY IF EXISTS "Sub users attach files to own response" ON sub_inquiry_files;
CREATE POLICY "Sub users attach files to own response"
  ON sub_inquiry_files FOR INSERT TO authenticated
  WITH CHECK (
    recipient_id IS NOT NULL
    AND is_own_sub_recipient(recipient_id)
    AND is_sub_inquiry_open(inquiry_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "Sub users remove own response files" ON sub_inquiry_files;
CREATE POLICY "Sub users remove own response files"
  ON sub_inquiry_files FOR DELETE TO authenticated
  USING (
    recipient_id IS NOT NULL
    AND is_own_sub_recipient(recipient_id)
    AND is_sub_inquiry_open(inquiry_id)
  );
