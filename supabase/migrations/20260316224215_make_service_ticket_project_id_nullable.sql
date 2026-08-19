/*
  # Make service_tickets.project_id nullable

  1. Changes
    - Alter `service_tickets.project_id` to allow NULL values
    - This enables creating service tickets from inquiry forms without a linked project

  2. Reason
    - Service tickets submitted via public forms (form_type = 'service') are not associated with any project
    - The edge function `submit-inquiry` creates tickets with organization_id but without project_id
*/

ALTER TABLE service_tickets ALTER COLUMN project_id DROP NOT NULL;
