/*
  # Add resolved_by to service_tickets

  1. Changes
    - Adds resolved_by column to track who completed the ticket
    - References profiles table

  2. Purpose
    - Track which user marked ticket as resolved/archived
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_tickets' AND column_name = 'resolved_by'
  ) THEN
    ALTER TABLE service_tickets ADD COLUMN resolved_by uuid REFERENCES profiles(id);
  END IF;
END $$;
