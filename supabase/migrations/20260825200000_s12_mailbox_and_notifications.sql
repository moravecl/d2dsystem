/*
  # S12: Prichozi posta (IMAP) + systemove notifikace

  1. smtp_accounts: IMAP pole (host/port/login/heslo/SSL/enabled + stav syncu)
  2. emails: prichozi zpravy s prirazenim k projektu (auto/manual/unassigned)
     + storage bucket email-attachments
  3. notifications: organization_id, link, dedupe_key; INSERT jen pro sebe
  4. notification_preferences: per-user nastaveni eventu + dni predem
  5. notify_org_users(): SECURITY DEFINER helper respektujici preference
  6. Triggery: schvaleni nabidky, rozhodnuti viceprace, novy lead,
     prirazeny ukol; tiketovy trigger preveden na helper
  7. pg_cron + pg_net: imap-sync co 5 min, notify-deadlines denne v 6:00
     (secret cte za behu z Vaultu - v migraci zadny secret neni)
*/

-- ============================================================
-- 1. IMAP pole na uctech
-- ============================================================
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['imap_host','imap_username','imap_password'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'smtp_accounts' AND column_name = col) THEN
      EXECUTE format('ALTER TABLE smtp_accounts ADD COLUMN %I text', col);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smtp_accounts' AND column_name = 'imap_port') THEN
    ALTER TABLE smtp_accounts ADD COLUMN imap_port integer NOT NULL DEFAULT 993;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smtp_accounts' AND column_name = 'imap_use_ssl') THEN
    ALTER TABLE smtp_accounts ADD COLUMN imap_use_ssl boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smtp_accounts' AND column_name = 'imap_enabled') THEN
    ALTER TABLE smtp_accounts ADD COLUMN imap_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smtp_accounts' AND column_name = 'imap_last_uid') THEN
    ALTER TABLE smtp_accounts ADD COLUMN imap_last_uid bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smtp_accounts' AND column_name = 'imap_last_synced_at') THEN
    ALTER TABLE smtp_accounts ADD COLUMN imap_last_synced_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 2. Prichozi posta
-- ============================================================
CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES smtp_accounts(id) ON DELETE SET NULL,
  message_id text NOT NULL,
  in_reply_to text,
  reference_ids text[] NOT NULL DEFAULT '{}',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  assignment_status text NOT NULL DEFAULT 'unassigned'
    CHECK (assignment_status IN ('auto', 'manual', 'unassigned')),
  assignment_confidence numeric,
  assignment_reason text NOT NULL DEFAULT '',
  assignment_engine text NOT NULL DEFAULT 'heuristic',
  attachments jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emails_account_message_unique UNIQUE (account_id, message_id)
);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_emails_org ON emails (organization_id);
CREATE INDEX IF NOT EXISTS idx_emails_project ON emails (project_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails (assignment_status);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails (received_at DESC);

DROP TRIGGER IF EXISTS s7_fill_org ON emails;
CREATE TRIGGER s7_fill_org BEFORE INSERT ON emails
  FOR EACH ROW EXECUTE FUNCTION s7_fill_organization_id();

DROP POLICY IF EXISTS "Org members can read emails" ON emails;
CREATE POLICY "Org members can read emails"
  ON emails FOR SELECT TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user());
DROP POLICY IF EXISTS "Org members can update emails" ON emails;
CREATE POLICY "Org members can update emails"
  ON emails FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user())
  WITH CHECK (organization_id = current_org_id());
DROP POLICY IF EXISTS "Org members can delete emails" ON emails;
CREATE POLICY "Org members can delete emails"
  ON emails FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user());
-- INSERT zamerne bez politiky: zapisuje jen imap-sync pod service roli

-- Storage bucket pro prilohy (cteni org-scoped pres prefix org_id/)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Org members can read email attachments" ON storage.objects;
CREATE POLICY "Org members can read email attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = current_org_id()::text
  );

-- ============================================================
-- 3. notifications upgrade
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'organization_id') THEN
    ALTER TABLE notifications ADD COLUMN organization_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'link') THEN
    ALTER TABLE notifications ADD COLUMN link text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'dedupe_key') THEN
    ALTER TABLE notifications ADD COLUMN dedupe_key text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Kdokoli mohl vlozit notifikaci komukoli; nove jen sam sobe
-- (cross-user zapisy jdou vyhradne pres SECURITY DEFINER helper nize)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4. Preference notifikaci (per uzivatel)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  days_before integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_prefs_user_event_unique UNIQUE (user_id, event_key)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences (user_id);

DROP POLICY IF EXISTS "Users manage own notification prefs" ON notification_preferences;
CREATE POLICY "Users manage own notification prefs"
  ON notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. Helper: notifikace clenum organizace dle preferenci
-- ============================================================
-- Bez radku v preferencich je event ZAPNUTY (default-on); radek s
-- enabled=false ho vypina. Dedupe pres ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION notify_org_users(
  p_org uuid,
  p_roles text[],
  p_type text,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id uuid,
  p_link text,
  p_event_key text,
  p_dedupe text DEFAULT NULL,
  p_extra_user uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, organization_id, type, title, message,
                             entity_type, entity_id, link, dedupe_key, is_read, created_at)
  SELECT DISTINCT u.uid, p_org, p_type, p_title, p_message,
         p_entity_type, p_entity_id, p_link, p_dedupe, false, now()
  FROM (
    SELECT om.user_id AS uid
    FROM organization_members om
    JOIN profiles p ON p.id = om.user_id
    WHERE om.organization_id = p_org
      AND om.role = ANY (p_roles)
      AND COALESCE(p.is_portal_client, false) = false
    UNION
    SELECT p_extra_user WHERE p_extra_user IS NOT NULL
  ) u
  LEFT JOIN notification_preferences np
    ON np.user_id = u.uid AND np.event_key = p_event_key
  WHERE COALESCE(np.enabled, true)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

-- Bezni uzivatele helper volat nesmi (mohli by spamovat cizi zvonky);
-- service_role ho potrebuje pro edge funkce (notify-deadlines, imap-sync).
REVOKE ALL ON FUNCTION notify_org_users(uuid, text[], text, text, text, text, uuid, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION notify_org_users(uuid, text[], text, text, text, text, uuid, text, text, text, uuid) TO service_role;

-- ============================================================
-- 6. Eventove triggery
-- ============================================================

-- 6a. Schvaleni / vraceni nabidky
CREATE OR REPLACE FUNCTION notify_quote_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid; v_project uuid; v_responsible uuid; v_pname text; v_qnum text;
BEGIN
  SELECT pq.project_id, pq.quote_number, pr.organization_id, pr.responsible_user_id,
         COALESCE(NULLIF(pr.project_name, ''), pr.name)
  INTO v_project, v_qnum, v_org, v_responsible, v_pname
  FROM project_quotes pq
  JOIN projects pr ON pr.id = pq.project_id
  WHERE pq.id = NEW.quote_id;

  IF v_org IS NULL THEN RETURN NEW; END IF;

  PERFORM notify_org_users(
    v_org, ARRAY['owner','admin','manager'],
    CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'warning' END,
    CASE WHEN NEW.status = 'approved'
      THEN 'Nabídka schválena'
      ELSE 'Nabídka vrácena' END,
    'Nabídka ' || COALESCE(v_qnum, '') || ' — ' || COALESCE(v_pname, ''),
    'project', v_project, '/projekty/' || v_project || '?tab=quotes',
    CASE WHEN NEW.status = 'approved' THEN 'quote_approved' ELSE 'quote_returned' END,
    'quote_decision:' || NEW.id,
    v_responsible
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_quote_decision ON quote_approvals;
CREATE TRIGGER trg_notify_quote_decision
  AFTER INSERT ON quote_approvals
  FOR EACH ROW EXECUTE FUNCTION notify_quote_decision();

-- 6b. Rozhodnuti o viceprace
CREATE OR REPLACE FUNCTION notify_viceprace_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_responsible uuid;
BEGIN
  IF NEW.status NOT IN ('approved', 'rejected')
     OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT pr.organization_id, pr.responsible_user_id INTO v_org, v_responsible
  FROM projects pr WHERE pr.id = NEW.project_id;
  IF v_org IS NULL THEN RETURN NEW; END IF;

  PERFORM notify_org_users(
    v_org, ARRAY['owner','admin','manager'],
    CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'warning' END,
    CASE WHEN NEW.status = 'approved' THEN 'Vícepráce schváleny' ELSE 'Vícepráce zamítnuty' END,
    NEW.title,
    'project', NEW.project_id, '/projekty/' || NEW.project_id || '?tab=viceprace',
    'viceprace_decided',
    'viceprace_decision:' || NEW.id || ':' || NEW.status,
    v_responsible
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_viceprace_decision ON viceprace;
CREATE TRIGGER trg_notify_viceprace_decision
  AFTER UPDATE ON viceprace
  FOR EACH ROW EXECUTE FUNCTION notify_viceprace_decision();

-- 6c. Novy lead z webu
CREATE OR REPLACE FUNCTION notify_new_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  PERFORM notify_org_users(
    NEW.organization_id, ARRAY['owner','admin','manager'],
    'info', 'Nový lead',
    COALESCE(NULLIF(NEW.name, ''), NEW.email, 'Bez jména'),
    'lead', NEW.id, '/leady',
    'new_lead', 'new_lead:' || NEW.id, NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_lead ON leads;
CREATE TRIGGER trg_notify_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION notify_new_lead();

-- 6d. Prirazeny ukol
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- nenotifikovat, kdyz si ukol prideluje sam aktor (u service role tvurce)
  IF NEW.assigned_to IS NULL
     OR NEW.assigned_to = COALESCE(auth.uid(), NEW.created_by)
     OR (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to) THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, organization_id, type, title, message,
                             entity_type, entity_id, link, dedupe_key)
  SELECT NEW.assigned_to, NEW.organization_id, 'task', 'Přiřazen úkol', NEW.title,
         'task', NEW.id, '/ukoly', 'task_assigned:' || NEW.id || ':' || NEW.assigned_to
  WHERE NOT EXISTS (
    SELECT 1 FROM notification_preferences np
    WHERE np.user_id = NEW.assigned_to AND np.event_key = 'task_assigned' AND np.enabled = false
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON tasks;
CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- 6e. Prijata platba (faktura prepnuta na 'paid')
CREATE OR REPLACE FUNCTION notify_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM notify_org_users(
    NEW.organization_id, ARRAY['owner','admin','manager'],
    'success', 'Faktura zaplacena',
    'Faktura ' || COALESCE(NULLIF(NEW.invoice_number, ''), '') || ' — '
      || ROUND(NEW.amount + NEW.tax_amount)::text || ' Kč',
    'invoice', NEW.id, '/finance/faktura/' || NEW.id,
    'payment_received', 'payment_received:' || NEW.id, NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_invoice_paid ON invoices;
CREATE TRIGGER trg_notify_invoice_paid
  AFTER UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION notify_invoice_paid();

-- 6f. Tiketovy trigger prejde na helper (ziska preference + dedupe + link)
CREATE OR REPLACE FUNCTION notify_new_service_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  PERFORM notify_org_users(
    NEW.organization_id, ARRAY['owner','admin','manager'],
    'service_ticket', 'Nový servisní tiket', COALESCE(NEW.title, ''),
    'service_ticket', NEW.id, '/servis?tab=tickets',
    'new_service_ticket', 'new_service_ticket:' || NEW.id, NULL
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7. Planovane joby (pg_cron + pg_net, secret z Vaultu za behu)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'imap-sync-5min') THEN
    PERFORM cron.unschedule('imap-sync-5min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-deadlines-daily') THEN
    PERFORM cron.unschedule('notify-deadlines-daily');
  END IF;

  PERFORM cron.schedule(
    'imap-sync-5min',
    '*/5 * * * *',
    $job$
    SELECT net.http_post(
      url := 'https://mvjteucnvvofmglsfsqc.supabase.co/functions/v1/imap-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
    $job$
  );

  PERFORM cron.schedule(
    'notify-deadlines-daily',
    '0 6 * * *',
    $job$
    SELECT net.http_post(
      url := 'https://mvjteucnvvofmglsfsqc.supabase.co/functions/v1/notify-deadlines',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
    $job$
  );
END $$;

-- ============================================================
-- PO MIGRACI RUCNE (jednou):
--   1) select vault.create_secret('<SILNE-NAHODNE-HESLO>', 'cron_secret');
--   2) stejnou hodnotu nastavit jako env CRON_SECRET u funkci
--      imap-sync a notify-deadlines (dashboard -> Edge Functions -> Secrets)
--
-- Kontrola:
--   select jobname, schedule from cron.job;                       -> 2 joby
--   select count(*) from pg_policies where tablename = 'emails';  -> 3
--   select column_name from information_schema.columns
--     where table_name='smtp_accounts' and column_name like 'imap%'; -> 8
-- ============================================================
