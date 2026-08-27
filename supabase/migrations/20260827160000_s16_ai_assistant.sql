/*
  # S16: AI Asistent - log behu a nakladu

  Kazde volani AI (shrnuti posty, trideni e-mailu...) zapise edge
  funkce ai-assistant do ai_runs: model, tokeny a odhad ceny v USD.
  Clenove organizace log ctou (prehled utraty primo v sekci Asistent);
  zapisuje jen service role.
*/

CREATE TABLE IF NOT EXISTS ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_runs_org_created ON ai_runs (organization_id, created_at DESC);

DROP POLICY IF EXISTS "Org members can read ai runs" ON ai_runs;
CREATE POLICY "Org members can read ai runs"
  ON ai_runs FOR SELECT TO authenticated
  USING (organization_id = current_org_id() AND NOT is_portal_client_user());
-- INSERT zamerne bez politiky: zapisuje jen edge funkce pod service roli

-- Kontrola: select count(*) from pg_policies where tablename = 'ai_runs'; -> 1
