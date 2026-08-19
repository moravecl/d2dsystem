/*
  # Client Portal & Execution Jobs Schema

  1. Modified Tables
    - `profiles` - Added `client_id` (uuid, FK to clients) to link portal users to client entities
    - `project_quotes` - Added `status` column to track approval state (draft/sent/approved/returned)

  2. New Tables
    - `quote_approvals` - Records of quote approval or return-to-edit actions
      - `id` (uuid, PK)
      - `quote_id` (uuid, FK to project_quotes)
      - `status` (text: 'approved' or 'returned')
      - `approved_by_name` (text) - name entered by client during approval
      - `scope_agreed`, `price_agreed`, `terms_agreed` (boolean) - consent checkboxes
      - `return_reason` (text) - reason for returning
      - `ip_address` (text) - client IP for audit
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)

    - `quote_comments` - Comment thread on quotes (portal + internal)
      - `id` (uuid, PK)
      - `quote_id` (uuid, FK to project_quotes)
      - `user_id` (uuid, FK to auth.users)
      - `content` (text)
      - `created_at` (timestamptz)

    - `portal_documents` - Documents shared with clients per project
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects)
      - `name` (text)
      - `description` (text)
      - `file_url` (text)
      - `file_type` (text)
      - `file_size` (integer) - bytes
      - `uploaded_by` (uuid, FK to auth.users)
      - `is_client_visible` (boolean, default true)
      - `created_at` (timestamptz)

    - `jobs` - Execution jobs created from approved quotes
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects)
      - `quote_id` (uuid, FK to project_quotes)
      - `status` (text: 'ready'/'in_progress'/'paused'/'completed')
      - `started_at`, `completed_at` (timestamptz)
      - `created_by` (uuid, FK to auth.users)
      - `created_at`, `updated_at` (timestamptz)

    - `job_worklogs` - Time entries with timer support
      - `id` (uuid, PK)
      - `job_id` (uuid, FK to jobs)
      - `user_id` (uuid, FK to auth.users)
      - `activity` (text) - type of work
      - `started_at`, `ended_at` (timestamptz) - for timer
      - `duration_minutes` (integer) - computed or manual
      - `note` (text)
      - `is_running` (boolean) - timer currently active
      - `created_at` (timestamptz)

    - `job_material_entries` - Material consumption tracking per job
      - `id` (uuid, PK)
      - `job_id` (uuid, FK to jobs)
      - `product_id` (uuid, FK to products, nullable)
      - `material_name` (text) - display name
      - `unit` (text)
      - `planned_qty` (numeric) - from quote
      - `actual_qty` (numeric) - consumed
      - `unit_price` (numeric)
      - `note` (text)
      - `is_unplanned` (boolean) - not in original quote
      - `photo_url` (text) - optional evidence photo
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)

    - `job_diary_entries` - Daily construction diary
      - `id` (uuid, PK)
      - `job_id` (uuid, FK to jobs)
      - `entry_date` (date)
      - `content` (text)
      - `people_on_site` (text[]) - array of user IDs
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)

    - `job_diary_photos` - Photos attached to diary entries
      - `id` (uuid, PK)
      - `diary_entry_id` (uuid, FK to job_diary_entries)
      - `url` (text)
      - `caption` (text)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on all new tables
    - Portal users (role='client') can only see their own client's projects
    - Internal users can manage all data they own
    - Quote comments accessible to both portal and internal users
*/

-- 1. Add client_id to profiles for portal user linking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add status to project_quotes for approval tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_quotes' AND column_name = 'status'
  ) THEN
    ALTER TABLE project_quotes ADD COLUMN status text NOT NULL DEFAULT 'draft';
  END IF;
END $$;

-- 3. Quote Approvals
CREATE TABLE IF NOT EXISTS quote_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES project_quotes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'approved',
  approved_by_name text NOT NULL DEFAULT '',
  scope_agreed boolean DEFAULT false,
  price_agreed boolean DEFAULT false,
  terms_agreed boolean DEFAULT false,
  return_reason text DEFAULT '',
  ip_address text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_approvals' AND policyname = 'Auth users can view quote approvals') THEN
    CREATE POLICY "Auth users can view quote approvals" ON quote_approvals FOR SELECT TO authenticated
      USING (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_quotes pq
          JOIN projects p ON p.id = pq.project_id
          WHERE pq.id = quote_approvals.quote_id AND p.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_approvals' AND policyname = 'Auth users can insert quote approvals') THEN
    CREATE POLICY "Auth users can insert quote approvals" ON quote_approvals FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- 4. Quote Comments
CREATE TABLE IF NOT EXISTS quote_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES project_quotes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quote_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_comments' AND policyname = 'Auth users can view quote comments') THEN
    CREATE POLICY "Auth users can view quote comments" ON quote_comments FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_quotes pq
          JOIN projects p ON p.id = pq.project_id
          WHERE pq.id = quote_comments.quote_id AND (p.user_id = auth.uid() OR p.client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()))
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_comments' AND policyname = 'Auth users can insert quote comments') THEN
    CREATE POLICY "Auth users can insert quote comments" ON quote_comments FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_comments' AND policyname = 'Users can delete own comments') THEN
    CREATE POLICY "Users can delete own comments" ON quote_comments FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 5. Portal Documents
CREATE TABLE IF NOT EXISTS portal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_type text DEFAULT '',
  file_size integer DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_client_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portal_documents' AND policyname = 'Project owners can manage portal documents') THEN
    CREATE POLICY "Project owners can manage portal documents" ON portal_documents FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM projects p WHERE p.id = portal_documents.project_id AND p.user_id = auth.uid()
        )
        OR (
          is_client_visible AND EXISTS (
            SELECT 1 FROM projects p
            JOIN profiles pr ON pr.client_id = p.client_id
            WHERE p.id = portal_documents.project_id AND pr.id = auth.uid()
          )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portal_documents' AND policyname = 'Project owners can insert portal documents') THEN
    CREATE POLICY "Project owners can insert portal documents" ON portal_documents FOR INSERT TO authenticated
      WITH CHECK (
        uploaded_by = auth.uid()
        AND (
          EXISTS (SELECT 1 FROM projects p WHERE p.id = portal_documents.project_id AND p.user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM projects p
            JOIN profiles pr ON pr.client_id = p.client_id
            WHERE p.id = portal_documents.project_id AND pr.id = auth.uid()
          )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portal_documents' AND policyname = 'Uploaders can delete portal documents') THEN
    CREATE POLICY "Uploaders can delete portal documents" ON portal_documents FOR DELETE TO authenticated
      USING (uploaded_by = auth.uid());
  END IF;
END $$;

-- 6. Jobs (Execution)
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES project_quotes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ready',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'Project owners can view jobs') THEN
    CREATE POLICY "Project owners can view jobs" ON jobs FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'Project owners can insert jobs') THEN
    CREATE POLICY "Project owners can insert jobs" ON jobs FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'Project owners can update jobs') THEN
    CREATE POLICY "Project owners can update jobs" ON jobs FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = jobs.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

-- 7. Job Worklogs (time tracking with timer)
CREATE TABLE IF NOT EXISTS job_worklogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL DEFAULT '',
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer DEFAULT 0,
  note text DEFAULT '',
  is_running boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_worklogs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_worklogs' AND policyname = 'Project owners can view job worklogs') THEN
    CREATE POLICY "Project owners can view job worklogs" ON job_worklogs FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM jobs j JOIN projects p ON p.id = j.project_id
        WHERE j.id = job_worklogs.job_id AND p.user_id = auth.uid()
      ) OR user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_worklogs' AND policyname = 'Auth users can insert job worklogs') THEN
    CREATE POLICY "Auth users can insert job worklogs" ON job_worklogs FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_worklogs' AND policyname = 'Users can update own worklogs') THEN
    CREATE POLICY "Users can update own worklogs" ON job_worklogs FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_worklogs' AND policyname = 'Users can delete own worklogs') THEN
    CREATE POLICY "Users can delete own worklogs" ON job_worklogs FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 8. Job Material Entries
CREATE TABLE IF NOT EXISTS job_material_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  material_name text NOT NULL DEFAULT '',
  unit text DEFAULT 'ks',
  planned_qty numeric DEFAULT 0,
  actual_qty numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  note text DEFAULT '',
  is_unplanned boolean DEFAULT false,
  photo_url text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_material_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_material_entries' AND policyname = 'Project owners can view job materials') THEN
    CREATE POLICY "Project owners can view job materials" ON job_material_entries FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM jobs j JOIN projects p ON p.id = j.project_id
        WHERE j.id = job_material_entries.job_id AND p.user_id = auth.uid()
      ) OR created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_material_entries' AND policyname = 'Auth users can insert job materials') THEN
    CREATE POLICY "Auth users can insert job materials" ON job_material_entries FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_material_entries' AND policyname = 'Creators can update job materials') THEN
    CREATE POLICY "Creators can update job materials" ON job_material_entries FOR UPDATE TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_material_entries' AND policyname = 'Creators can delete job materials') THEN
    CREATE POLICY "Creators can delete job materials" ON job_material_entries FOR DELETE TO authenticated
      USING (created_by = auth.uid());
  END IF;
END $$;

-- 9. Job Diary Entries
CREATE TABLE IF NOT EXISTS job_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  content text NOT NULL DEFAULT '',
  people_on_site text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_diary_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_diary_entries' AND policyname = 'Project owners can view diary entries') THEN
    CREATE POLICY "Project owners can view diary entries" ON job_diary_entries FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM jobs j JOIN projects p ON p.id = j.project_id
        WHERE j.id = job_diary_entries.job_id AND p.user_id = auth.uid()
      ) OR created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_diary_entries' AND policyname = 'Auth users can insert diary entries') THEN
    CREATE POLICY "Auth users can insert diary entries" ON job_diary_entries FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_diary_entries' AND policyname = 'Creators can update diary entries') THEN
    CREATE POLICY "Creators can update diary entries" ON job_diary_entries FOR UPDATE TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_diary_entries' AND policyname = 'Creators can delete diary entries') THEN
    CREATE POLICY "Creators can delete diary entries" ON job_diary_entries FOR DELETE TO authenticated
      USING (created_by = auth.uid());
  END IF;
END $$;

-- 10. Job Diary Photos
CREATE TABLE IF NOT EXISTS job_diary_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id uuid NOT NULL REFERENCES job_diary_entries(id) ON DELETE CASCADE,
  url text NOT NULL DEFAULT '',
  caption text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_diary_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_diary_photos' AND policyname = 'Diary photo viewers') THEN
    CREATE POLICY "Diary photo viewers" ON job_diary_photos FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM job_diary_entries de
        JOIN jobs j ON j.id = de.job_id
        JOIN projects p ON p.id = j.project_id
        WHERE de.id = job_diary_photos.diary_entry_id AND p.user_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM job_diary_entries de
        WHERE de.id = job_diary_photos.diary_entry_id AND de.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_diary_photos' AND policyname = 'Auth users can insert diary photos') THEN
    CREATE POLICY "Auth users can insert diary photos" ON job_diary_photos FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM job_diary_entries de WHERE de.id = job_diary_photos.diary_entry_id AND de.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_diary_photos' AND policyname = 'Creators can delete diary photos') THEN
    CREATE POLICY "Creators can delete diary photos" ON job_diary_photos FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM job_diary_entries de WHERE de.id = job_diary_photos.diary_entry_id AND de.created_by = auth.uid()
      ));
  END IF;
END $$;
