/*
  # S13: E-mailovy kanal notifikaci

  Kazdy event si uzivatel voli nezavisle: v systemu (zvonek, vychozi
  ZAPNUTO) a/nebo e-mailem (vychozi VYPNUTO). E-maily se neposilaji
  primo z triggeru - radky padaji do fronty notification_email_queue
  a edge funkce notify-emails je kazdych 5 minut rozesle pres SMTP
  ucet organizace (souhrnne, max 1 e-mail na uzivatele a beh).

  1. notification_preferences.email_enabled (default false)
  2. fronta notification_email_queue (jen service role; dedupe klic)
  3. notify_org_users: navic plni frontu dle preferenci
  4. notify_task_assigned: totez pro prirazene ukoly
  5. pg_cron job notify-emails-5min (secret z Vaultu za behu)
*/

-- ============================================================
-- 1. Preference: e-mailovy kanal
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'email_enabled') THEN
    ALTER TABLE notification_preferences ADD COLUMN email_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 2. Fronta odchozich notifikacnich e-mailu
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  event_key text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  link text,
  dedupe_key text,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- RLS bez politik: s frontou pracuje vyhradne service role (edge funkce)
ALTER TABLE notification_email_queue ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_email_queue_dedupe
  ON notification_email_queue (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_email_queue_pending
  ON notification_email_queue (created_at) WHERE sent_at IS NULL;

-- ============================================================
-- 3. notify_org_users: zvonek + fronta e-mailu dle preferenci
-- ============================================================
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
  -- zvonek: bez zaznamu v preferencich ZAPNUTO
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

  -- e-mail: bez zaznamu v preferencich VYPNUTO
  INSERT INTO notification_email_queue (user_id, organization_id, event_key,
                                        title, message, link, dedupe_key)
  SELECT DISTINCT u.uid, p_org, p_event_key, p_title, p_message, p_link, p_dedupe
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
  JOIN notification_preferences np
    ON np.user_id = u.uid AND np.event_key = p_event_key AND np.email_enabled
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

-- ============================================================
-- 4. Prirazeny ukol: navic fronta e-mailu
-- ============================================================
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

  INSERT INTO notification_email_queue (user_id, organization_id, event_key,
                                        title, message, link, dedupe_key)
  SELECT NEW.assigned_to, NEW.organization_id, 'task_assigned', 'Přiřazen úkol', NEW.title,
         '/ukoly', 'task_assigned:' || NEW.id || ':' || NEW.assigned_to
  WHERE EXISTS (
    SELECT 1 FROM notification_preferences np
    WHERE np.user_id = NEW.assigned_to AND np.event_key = 'task_assigned' AND np.email_enabled
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Cron: rozesilani fronty kazdych 5 minut
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-emails-5min') THEN
    PERFORM cron.unschedule('notify-emails-5min');
  END IF;

  PERFORM cron.schedule(
    'notify-emails-5min',
    '*/5 * * * *',
    $job$
    SELECT net.http_post(
      url := 'https://mvjteucnvvofmglsfsqc.supabase.co/functions/v1/notify-emails',
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
-- Kontrola:
--   select jobname from cron.job;  -> 3 joby (imap-sync-5min,
--     notify-deadlines-daily, notify-emails-5min)
--   select column_name from information_schema.columns
--     where table_name='notification_preferences'
--       and column_name='email_enabled';  -> 1 radek
-- ============================================================
