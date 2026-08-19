/*
  # Fix service report items insert policy
  
  1. Problem
    - Insert policy is missing WITH CHECK clause
    - Items cannot be inserted because RLS blocks them
  
  2. Solution
    - Drop existing insert policy
    - Create new insert policy with proper WITH CHECK
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
        AND sr.locked_at IS NULL
    )
  );