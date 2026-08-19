/*
  # Fix warehouse_transactions org isolation

  ## Problem
  warehouse_transactions has no organization_id column.
  RLS policy is USING (auth.uid() IS NOT NULL) — any authenticated user sees all transactions.

  ## Solution
  Filter via JOIN on warehouse_items which has organization_id.
  No new column needed — the parent item always belongs to an org.
*/

DROP POLICY IF EXISTS "Authenticated users can read warehouse transactions" ON warehouse_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert warehouse transactions" ON warehouse_transactions;
DROP POLICY IF EXISTS "Authenticated users can update warehouse transactions" ON warehouse_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete warehouse transactions" ON warehouse_transactions;
DROP POLICY IF EXISTS "Org members can view warehouse transactions" ON warehouse_transactions;
DROP POLICY IF EXISTS "Org members can insert warehouse transactions" ON warehouse_transactions;
DROP POLICY IF EXISTS "Org members can update warehouse transactions" ON warehouse_transactions;
DROP POLICY IF EXISTS "Org members can delete warehouse transactions" ON warehouse_transactions;

CREATE POLICY "Org members can view warehouse transactions"
  ON warehouse_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_items wi
      WHERE wi.id = warehouse_transactions.item_id
        AND wi.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can insert warehouse transactions"
  ON warehouse_transactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM warehouse_items wi
      WHERE wi.id = warehouse_transactions.item_id
        AND wi.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can update warehouse transactions"
  ON warehouse_transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_items wi
      WHERE wi.id = warehouse_transactions.item_id
        AND wi.organization_id = get_my_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouse_items wi
      WHERE wi.id = warehouse_transactions.item_id
        AND wi.organization_id = get_my_organization_id()
    )
  );

CREATE POLICY "Org members can delete warehouse transactions"
  ON warehouse_transactions FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM warehouse_items wi
      WHERE wi.id = warehouse_transactions.item_id
        AND wi.organization_id = get_my_organization_id()
    )
  );
