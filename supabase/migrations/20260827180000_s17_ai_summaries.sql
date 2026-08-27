/*
  # S17: Historie shrnuti AI asistenta

  Kazde shrnuti posty se uklada (obdobi, text, navrzene akce vc. stavu
  proposed/executed). Slouzi k:
  1. prirustkove analyze - tlacitko "od posledniho shrnuti"
  2. deduplikaci - asistent dostava drive navrzene akce a nenavrhuje
     je znovu
  3. historii dole na strance s rozbalenim vystupu a stavu akci

  Zapisuje edge funkce (service role), stav akci aktualizuje uzivatel
  po provedeni (UPDATE pro cleny organizace).
*/

CREATE TABLE IF NOT EXISTS ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  date_from timestamptz NOT NULL,
  date_to timestamptz NOT NULL,
  emails_count integer NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  actions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_summaries_org_created ON ai_summaries (organization_id, created_at DESC);

DROP POLICY IF EXISTS "Org members can read ai summaries" ON ai_summaries;
CREATE POLICY "Org members can read ai summaries"
  ON ai_summaries FOR SELECT TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user());

DROP POLICY IF EXISTS "Org members can update ai summaries" ON ai_summaries;
CREATE POLICY "Org members can update ai summaries"
  ON ai_summaries FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user())
  WITH CHECK (organization_id = current_org_id());
-- INSERT zamerne bez politiky: zapisuje jen edge funkce pod service roli

-- Kontrola: select count(*) from pg_policies where tablename = 'ai_summaries'; -> 2
