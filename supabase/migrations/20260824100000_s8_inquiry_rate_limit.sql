/*
  # S8: Rate-limit tabulka pro verejny endpoint submit-inquiry

  Edge funkce submit-inquiry je zamerne verejna (embed formulare na cizich
  webech) a bezi pod SERVICE_ROLE. Dosud nemela zadny limit — kdokoli mohl
  zaplavit tabulky leads / service_tickets.

  Tato tabulka je jeji pocitadlo: funkce pred zpracovanim overi pocet
  zaznamu z dane IP (5 / 10 min) a na dany formular (30 / hod).

  RLS je zapnute BEZ politik — k tabulce se dostane jen service role
  (ta RLS obchazi). Bezni uzivatele ji nevidi a nepotrebuji.
*/

CREATE TABLE IF NOT EXISTS inquiry_submission_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip text NOT NULL,
  form_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inquiry_submission_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_isl_ip_time   ON inquiry_submission_log (ip, created_at);
CREATE INDEX IF NOT EXISTS idx_isl_form_time ON inquiry_submission_log (form_id, created_at);
CREATE INDEX IF NOT EXISTS idx_isl_time      ON inquiry_submission_log (created_at);
