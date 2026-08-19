/*
  # Make technician_ids nullable in service_schedules

  1. Changes
    - Alter `technician_ids` column in `service_schedules` to allow NULL values
    - This allows creating service schedules without assigned technicians
    - Technicians can be assigned later when scheduling the service

  2. Rationale
    - When converting tickets to service, technicians may not be assigned yet
    - Allows for "unassigned" services that can be delegated later
*/

ALTER TABLE service_schedules
ALTER COLUMN technician_ids DROP NOT NULL;
