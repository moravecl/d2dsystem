/*
  # S29: Chat mezi objednatelem a subdodavatelem na zakázce

  - `sub_job_messages`: zprávy vázané na job_subcontractors (přiřazení
    subky na zakázku). Org strana píše z modalu zakázky, subka z portálu.
  - RLS: org přes organization_id (trigger doplní z přiřazení, vzor S27),
    subka čte vše ke své zakázce a vkládá jen vlastní zprávy (is_from_sub).
  - Zpráva od subky notifikuje uživatele organizace (notify_org_users
    vyžaduje explicitní pole rolí — NULL nikoho nenotifikuje).
*/

CREATE TABLE IF NOT EXISTS sub_job_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_subcontractor_id uuid NOT NULL REFERENCES job_subcontractors(id) ON DELETE CASCADE,
  is_from_sub boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sub_job_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_job_messages_js ON sub_job_messages(job_subcontractor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sub_job_messages_org ON sub_job_messages(organization_id);

-- org se doplní z přiřazení (portálový insert nemá current_org_id)
DROP TRIGGER IF EXISTS fill_org_from_js ON sub_job_messages;
CREATE TRIGGER fill_org_from_js BEFORE INSERT ON sub_job_messages
  FOR EACH ROW EXECUTE FUNCTION s27_fill_org_from_js();

DROP POLICY IF EXISTS "Org members manage sub messages" ON sub_job_messages;
CREATE POLICY "Org members manage sub messages"
  ON sub_job_messages FOR ALL TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

DROP POLICY IF EXISTS "Sub users read own job messages" ON sub_job_messages;
CREATE POLICY "Sub users read own job messages"
  ON sub_job_messages FOR SELECT TO authenticated
  USING (is_own_job_subcontractor(job_subcontractor_id));

DROP POLICY IF EXISTS "Sub users send own job messages" ON sub_job_messages;
CREATE POLICY "Sub users send own job messages"
  ON sub_job_messages FOR INSERT TO authenticated
  WITH CHECK (
    is_own_job_subcontractor(job_subcontractor_id)
    AND is_from_sub = true
    AND created_by = auth.uid()
  );

-- notifikace org uživatelům při zprávě od subky
CREATE OR REPLACE FUNCTION s29_notify_sub_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_name text;
BEGIN
  IF NEW.is_from_sub THEN
    SELECT s.name INTO v_sub_name
    FROM job_subcontractors js
    JOIN subcontractors s ON s.id = js.subcontractor_id
    WHERE js.id = NEW.job_subcontractor_id;

    PERFORM notify_org_users(
      NEW.organization_id, ARRAY['owner','admin','manager','employee'],
      'sub_message', 'Zpráva od subdodavatele',
      COALESCE(v_sub_name, 'Subdodavatel') || ': ' || left(NEW.message, 120),
      'job_subcontractor', NEW.job_subcontractor_id, '/subdodavatele', 'sub_message', NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_sub_message ON sub_job_messages;
CREATE TRIGGER notify_sub_message AFTER INSERT ON sub_job_messages
  FOR EACH ROW EXECUTE FUNCTION s29_notify_sub_message();
