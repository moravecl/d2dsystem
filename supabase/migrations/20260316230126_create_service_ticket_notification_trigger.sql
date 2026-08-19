/*
  # Create notification trigger for new service tickets

  1. Changes
    - Creates a trigger function that fires when new service ticket is created
    - Notifies all users with admin/manager role in the organization
    - Creates notification record with ticket details

  2. Purpose
    - Users see bell notification when new service ticket arrives from form
*/

CREATE OR REPLACE FUNCTION notify_new_service_ticket()
RETURNS TRIGGER AS $$
DECLARE
  target_user RECORD;
BEGIN
  FOR target_user IN
    SELECT om.user_id
    FROM organization_members om
    JOIN profiles p ON p.id = om.user_id
    WHERE om.organization_id = NEW.organization_id
      AND om.role IN ('admin', 'owner', 'manager')
      AND p.is_portal_client = false
  LOOP
    INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, is_read, created_at)
    VALUES (
      target_user.user_id,
      'service_ticket',
      'Novy servisni tiket',
      COALESCE(NEW.title, 'Novy pozadavek'),
      'service_ticket',
      NEW.id,
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_service_ticket ON service_tickets;

CREATE TRIGGER trg_notify_new_service_ticket
  AFTER INSERT ON service_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_service_ticket();
