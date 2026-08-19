/*
  # Refresh schema cache for sticky_notes

  Forces PostgREST schema cache to reload so that the sticky_notes table
  becomes accessible through the API.
*/

NOTIFY pgrst, 'reload schema';
