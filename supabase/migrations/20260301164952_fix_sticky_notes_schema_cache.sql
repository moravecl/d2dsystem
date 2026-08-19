/*
  # Fix sticky_notes PostgREST schema cache

  ## Summary
  Forces PostgREST to recognize the sticky_notes table by adding a harmless
  comment on the table and sending the schema reload notification.

  ## Changes
  - Adds a table comment to sticky_notes (forces schema change detection)
  - Sends NOTIFY pgrst to reload the schema cache
*/

COMMENT ON TABLE public.sticky_notes IS 'Personal sticky notes for dashboard';

NOTIFY pgrst, 'reload schema';
