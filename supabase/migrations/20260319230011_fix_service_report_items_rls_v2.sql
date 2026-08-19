/*
  # Fix service_report_items RLS for INSERT

  The issue is that when creating a report and inserting items in the same
  transaction, the RLS policy cannot see the report's org_id yet.

  Solution: Allow insert if the user created the report (created_by = auth.uid())
  OR if user belongs to the same org as the report.
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
        AND sr.locked_at IS NULL
        AND (
          sr.created_by = auth.uid()
          OR sr.org_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
          )
        )
    )
  );
