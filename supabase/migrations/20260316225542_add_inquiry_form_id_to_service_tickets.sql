/*
  # Add inquiry_form_id to service_tickets

  1. Changes
    - Adds `inquiry_form_id` column to link ticket to source inquiry form
    - This allows fetching field labels from the form definition

  2. Purpose
    - When displaying form_data, we can show proper field labels instead of keys
*/

ALTER TABLE service_tickets
ADD COLUMN IF NOT EXISTS inquiry_form_id uuid REFERENCES inquiry_forms(id) ON DELETE SET NULL;
