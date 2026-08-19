/*
  # Execution Phase Schema

  1. Modified Tables
    - `projects` - Added `phase` column (text) to track project lifecycle phase
      - Values: 'design', 'quote', 'approval', 'execution', 'completed_final'
    - `projects` - Added `approved_at` (timestamptz) for client approval timestamp
    - `projects` - Added `execution_started_at` (timestamptz) for execution start timestamp
    - `project_shares` - Added `quote_released` (boolean) and `quote_released_at` (timestamptz)

  2. New Tables
    - `execution_tasks` - Task management linked to project pins/locations
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `pin_placement_id` (uuid, optional FK to pin_placements)
      - `title`, `description`, `status`, `priority`, `assigned_to`
      - `room_name`, `floor_name` for location context
      - `due_date`, `completed_at`, `sort_order`
    - `execution_material_usage` - Tracks actual vs quoted material quantities
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `quote_section_name`, `quote_item_name` for traceability
      - `product_id` (uuid, optional FK to products)
      - `unit`, `quoted_quantity`, `actual_quantity`, `note`
    - `execution_time_entries` - Time logging per task/project
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `task_id` (uuid, optional FK to execution_tasks)
      - `worker_name`, `description`, `hours`, `date`

  3. Data Migration
    - Existing projects get `phase` based on their `status`:
      - draft / in_progress -> 'design'
      - completed -> 'quote'
      - sent -> 'approval'

  4. Security
    - RLS enabled on all new tables
    - Project owners can CRUD their own execution data
    - No anonymous access to execution tables
*/

-- Add phase column to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'phase'
  ) THEN
    ALTER TABLE projects ADD COLUMN phase text NOT NULL DEFAULT 'design';
  END IF;
END $$;

-- Add approval/execution timestamps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN approved_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'execution_started_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN execution_started_at timestamptz;
  END IF;
END $$;

-- Add quote_released to project_shares
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_shares' AND column_name = 'quote_released'
  ) THEN
    ALTER TABLE project_shares ADD COLUMN quote_released boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_shares' AND column_name = 'quote_released_at'
  ) THEN
    ALTER TABLE project_shares ADD COLUMN quote_released_at timestamptz;
  END IF;
END $$;

-- Migrate existing status data to phase
UPDATE projects SET phase =
  CASE
    WHEN status IN ('draft', 'in_progress') THEN 'design'
    WHEN status = 'completed' THEN 'quote'
    WHEN status = 'sent' THEN 'approval'
    ELSE 'design'
  END
WHERE phase = 'design' AND status IS NOT NULL AND status != 'draft';

-- Execution Tasks
CREATE TABLE IF NOT EXISTS execution_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pin_placement_id uuid REFERENCES pin_placements(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to text DEFAULT '',
  room_name text DEFAULT '',
  floor_name text DEFAULT '',
  due_date date,
  completed_at timestamptz,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE execution_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_tasks' AND policyname = 'Project owners can view tasks') THEN
    CREATE POLICY "Project owners can view tasks" ON execution_tasks FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_tasks.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_tasks' AND policyname = 'Project owners can insert tasks') THEN
    CREATE POLICY "Project owners can insert tasks" ON execution_tasks FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_tasks.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_tasks' AND policyname = 'Project owners can update tasks') THEN
    CREATE POLICY "Project owners can update tasks" ON execution_tasks FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_tasks.project_id AND projects.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_tasks.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_tasks' AND policyname = 'Project owners can delete tasks') THEN
    CREATE POLICY "Project owners can delete tasks" ON execution_tasks FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_tasks.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

-- Execution Material Usage
CREATE TABLE IF NOT EXISTS execution_material_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_section_name text DEFAULT '',
  quote_item_name text DEFAULT '',
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  unit text DEFAULT 'ks',
  quoted_quantity numeric DEFAULT 0,
  actual_quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  note text DEFAULT '',
  recorded_by uuid,
  recorded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE execution_material_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_material_usage' AND policyname = 'Project owners can view material usage') THEN
    CREATE POLICY "Project owners can view material usage" ON execution_material_usage FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_material_usage.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_material_usage' AND policyname = 'Project owners can insert material usage') THEN
    CREATE POLICY "Project owners can insert material usage" ON execution_material_usage FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_material_usage.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_material_usage' AND policyname = 'Project owners can update material usage') THEN
    CREATE POLICY "Project owners can update material usage" ON execution_material_usage FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_material_usage.project_id AND projects.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_material_usage.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_material_usage' AND policyname = 'Project owners can delete material usage') THEN
    CREATE POLICY "Project owners can delete material usage" ON execution_material_usage FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_material_usage.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

-- Execution Time Entries
CREATE TABLE IF NOT EXISTS execution_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES execution_tasks(id) ON DELETE SET NULL,
  worker_name text DEFAULT '',
  description text DEFAULT '',
  hours numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE execution_time_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_time_entries' AND policyname = 'Project owners can view time entries') THEN
    CREATE POLICY "Project owners can view time entries" ON execution_time_entries FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_time_entries.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_time_entries' AND policyname = 'Project owners can insert time entries') THEN
    CREATE POLICY "Project owners can insert time entries" ON execution_time_entries FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_time_entries.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_time_entries' AND policyname = 'Project owners can update time entries') THEN
    CREATE POLICY "Project owners can update time entries" ON execution_time_entries FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_time_entries.project_id AND projects.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_time_entries.project_id AND projects.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_time_entries' AND policyname = 'Project owners can delete time entries') THEN
    CREATE POLICY "Project owners can delete time entries" ON execution_time_entries FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = execution_time_entries.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;
