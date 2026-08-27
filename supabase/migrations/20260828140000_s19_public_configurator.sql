/*
  # S19: Verejny konfigurator

  1. configurator_settings: public_token (odkaz pro zakazniky) a
     public_enabled (zapnuti). Cenik verejneho konfiguratoru zije
     v config jsonb pod klicem "public" (edituje administrace).
  2. public_config_log: rate limit odeslani dle IP (jen service role).

  Odeslani z verejneho konfiguratoru vytvari LEAD (source
  'konfigurator') pres edge funkci public-configurator - trigger
  notifikaci o novem leadu se spousti automaticky.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configurator_settings' AND column_name = 'public_token') THEN
    ALTER TABLE configurator_settings ADD COLUMN public_token uuid NOT NULL DEFAULT gen_random_uuid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configurator_settings' AND column_name = 'public_enabled') THEN
    ALTER TABLE configurator_settings ADD COLUMN public_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_configurator_settings_public_token
  ON configurator_settings (public_token);

CREATE TABLE IF NOT EXISTS public_config_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS bez politik: pouze service role (edge funkce)
ALTER TABLE public_config_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_public_config_log_ip_created
  ON public_config_log (ip, created_at DESC);

-- Kontrola:
--   select public_token, public_enabled from configurator_settings;
--   (odkaz: https://dev.housesmart.cz/kalkulacka/<public_token>)
