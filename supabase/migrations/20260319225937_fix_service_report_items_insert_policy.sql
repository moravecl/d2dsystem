/*
  # Fix service_report_items INSERT RLS policy

  The current policy fails because it checks locked_at IS NULL but reports
  may not be locked when adding items. We need to allow inserts when:
  1. The report exists
  2. User belongs to the same organization
  3. Report is not locked (to prevent edits after locking)

  This migration drops and recreates the INSERT policy with correct logic.
*/

DROP POLICY IF EXISTS "Users can insert service report items" ON service_report_items;

CREATE POLICY "Users can insert service report items"
  ON service_report_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_reports sr
      WHERE sr.id = service_report_items.report_id
        AND sr.org_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
        )
        AND (sr.locked_at IS NULL)
    )
  );
