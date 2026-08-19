/*
  # Fix jobs and execution tables RLS for admins and managers

  1. Problem
    - The `jobs`, `job_worklogs`, `job_material_entries`, `job_diary_entries`, and
      `job_diary_photos` tables only allowed access to project owners (p.user_id = auth.uid())
    - Admin and manager users who can see projects could not create or view jobs
    - This caused "error when creating job" for non-owner users

  2. Changes
    - Updated SELECT, INSERT, UPDATE policies on `jobs` to also allow admin/manager roles
    - Updated SELECT policies on `job_worklogs`, `job_material_entries`, `job_diary_entries`
      to also allow admin/manager roles
    - Updated INSERT/UPDATE/DELETE policies on execution sub-tables to allow admin/manager roles

  3. Security
    - Access is still restricted to authenticated users
    - Only admin and manager roles get expanded access (matching projects table policies)
    - Regular users still only see their own data
*/

-- Helper: check if user is admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role IN ('admin', 'manager')
  );
$$;

-- ============================================================
-- JOBS table: drop old policies and recreate with admin/manager
-- ============================================================

DROP POLICY IF EXISTS "Project owners can view jobs" ON jobs;
CREATE POLICY "Project owners can view jobs" ON jobs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid())
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can insert jobs" ON jobs;
CREATE POLICY "Project owners can insert jobs" ON jobs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid())
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Project owners can update jobs" ON jobs;
CREATE POLICY "Project owners can update jobs" ON jobs FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid())
    OR is_admin_or_manager(auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid())
    OR is_admin_or_manager(auth.uid())
  );

-- ============================================================
-- JOB_WORKLOGS table
-- ============================================================

DROP POLICY IF EXISTS "Project owners can view job worklogs" ON job_worklogs;
CREATE POLICY "Project owners can view job worklogs" ON job_worklogs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs j JOIN projects p ON p.id = j.project_id
      WHERE j.id = job_worklogs.job_id AND p.user_id = auth.uid()
    )
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Auth users can insert job worklogs" ON job_worklogs;
CREATE POLICY "Auth users can insert job worklogs" ON job_worklogs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own worklogs" ON job_worklogs;
CREATE POLICY "Users can update own worklogs" ON job_worklogs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_manager(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own worklogs" ON job_worklogs;
CREATE POLICY "Users can delete own worklogs" ON job_worklogs FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_manager(auth.uid()));

-- ============================================================
-- JOB_MATERIAL_ENTRIES table
-- ============================================================

DROP POLICY IF EXISTS "Project owners can view job materials" ON job_material_entries;
CREATE POLICY "Project owners can view job materials" ON job_material_entries FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs j JOIN projects p ON p.id = j.project_id
      WHERE j.id = job_material_entries.job_id AND p.user_id = auth.uid()
    )
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Auth users can insert job materials" ON job_material_entries;
CREATE POLICY "Auth users can insert job materials" ON job_material_entries FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Creators can update job materials" ON job_material_entries;
CREATE POLICY "Creators can update job materials" ON job_material_entries FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Creators can delete job materials" ON job_material_entries;
CREATE POLICY "Creators can delete job materials" ON job_material_entries FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_admin_or_manager(auth.uid()));

-- ============================================================
-- JOB_DIARY_ENTRIES table
-- ============================================================

DROP POLICY IF EXISTS "Project owners can view diary entries" ON job_diary_entries;
CREATE POLICY "Project owners can view diary entries" ON job_diary_entries FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs j JOIN projects p ON p.id = j.project_id
      WHERE j.id = job_diary_entries.job_id AND p.user_id = auth.uid()
    )
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Auth users can insert diary entries" ON job_diary_entries;
CREATE POLICY "Auth users can insert diary entries" ON job_diary_entries FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Creators can update diary entries" ON job_diary_entries;
CREATE POLICY "Creators can update diary entries" ON job_diary_entries FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Creators can delete diary entries" ON job_diary_entries;
CREATE POLICY "Creators can delete diary entries" ON job_diary_entries FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_admin_or_manager(auth.uid()));

-- ============================================================
-- JOB_DIARY_PHOTOS table
-- ============================================================

DROP POLICY IF EXISTS "Diary photo viewers" ON job_diary_photos;
CREATE POLICY "Diary photo viewers" ON job_diary_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_diary_entries de
      JOIN jobs j ON j.id = de.job_id
      JOIN projects p ON p.id = j.project_id
      WHERE de.id = job_diary_photos.diary_entry_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_diary_entries de
      WHERE de.id = job_diary_photos.diary_entry_id AND de.created_by = auth.uid()
    )
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Auth users can insert diary photos" ON job_diary_photos;
CREATE POLICY "Auth users can insert diary photos" ON job_diary_photos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_diary_entries de WHERE de.id = job_diary_photos.diary_entry_id AND de.created_by = auth.uid()
    )
    OR is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Creators can delete diary photos" ON job_diary_photos;
CREATE POLICY "Creators can delete diary photos" ON job_diary_photos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_diary_entries de WHERE de.id = job_diary_photos.diary_entry_id AND de.created_by = auth.uid()
    )
    OR is_admin_or_manager(auth.uid())
  );
