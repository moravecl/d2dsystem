/*
  # Add form_data column to service_tickets

  1. Changes
    - Adds `form_data` JSONB column to store all form fields from inquiry forms
    - This allows structured storage of custom form fields (e.g., address, SOC value, mode settings)

  2. Purpose
    - When service tickets are created from inquiry forms, all form fields are preserved
    - The detail drawer can display each field separately instead of one merged text block
*/

ALTER TABLE service_tickets
ADD COLUMN IF NOT EXISTS form_data jsonb DEFAULT NULL;

COMMENT ON COLUMN service_tickets.form_data IS 'Stores all form field data when ticket is created from an inquiry form';
