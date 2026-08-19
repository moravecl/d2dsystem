/*
  # Make next_date nullable in service_schedules

  1. Changes
    - Alter `next_date` column in `service_schedules` to allow NULL values
    - This allows creating service schedules without an immediate scheduled date
    - Users can plan the date later through the service management interface

  2. Rationale
    - When converting tickets to service, users may not know the exact date yet
    - Allows for "unscheduled" services that can be planned later
*/

ALTER TABLE service_schedules
ALTER COLUMN next_date DROP NOT NULL;
