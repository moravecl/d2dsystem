/*
  # Multi-quote execution support and admin approval enhancements

  1. Modified Tables
    - `jobs`
      - Add `included_quote_ids` (uuid[], array of all quote IDs included in this job)

    - `quote_approvals`
      - Add `approved_by_admin` (boolean, marks admin-only approvals without client)
      - Add `admin_note` (text, note when admin approves without client)

  2. Security Changes
    - Add admin SELECT policy on `quote_approvals` so admins can see all approvals
    - Add admin INSERT policy on `quote_approvals` so admins can create approvals
    - Add admin UPDATE policy on `project_quotes` status for admin approval

  3. Notes
    - The `included_quote_ids` column allows a single job to track materials from
      multiple approved quotes (e.g. original scope + additional work)
    - Admin approval records are distinguished by the `approved_by_admin` flag
*/

-- 1. Add included_quote_ids to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'included_quote_ids'
  ) THEN
    ALTER TABLE jobs ADD COLUMN included_quote_ids uuid[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- 2. Add admin approval columns to quote_approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_approvals' AND column_name = 'approved_by_admin'
  ) THEN
    ALTER TABLE quote_approvals ADD COLUMN approved_by_admin boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_approvals' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE quote_approvals ADD COLUMN admin_note text NOT NULL DEFAULT '';
  END IF;
END $$;

-- 3. Admin policies for quote_approvals
CREATE POLICY "Admins can view all quote approvals"
  ON quote_approvals
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert quote approvals"
  ON quote_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND is_admin(auth.uid())
  );
