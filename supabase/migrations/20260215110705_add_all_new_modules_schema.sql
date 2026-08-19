/*
  # Add all new modules schema

  1. New Tables
    - `project_milestones` - Milestones for Gantt chart per project
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects)
      - `name` (text)
      - `start_date` (date)
      - `end_date` (date)
      - `status` (text: planned/in_progress/completed)
      - `sort_order` (int)
      - `color` (text)
    - `tasks` - Task items for Kanban board
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects, nullable)
      - `milestone_id` (uuid, FK to project_milestones, nullable)
      - `title` (text)
      - `description` (text)
      - `status` (text: todo/in_progress/done/blocked)
      - `priority` (text: low/medium/high/urgent)
      - `assigned_to` (uuid, FK to profiles, nullable)
      - `created_by` (uuid)
      - `due_date` (date, nullable)
      - `sort_order` (int)
    - `time_entries` - Time tracking entries
      - `id` (uuid, PK)
      - `user_id` (uuid, FK to profiles)
      - `project_id` (uuid, FK to projects, nullable)
      - `task_id` (uuid, FK to tasks, nullable)
      - `date` (date)
      - `duration_minutes` (int)
      - `description` (text)
      - `billable` (boolean)
    - `warehouse_items` - Inventory items
      - `id` (uuid, PK)
      - `name` (text)
      - `sku` (text)
      - `unit` (text)
      - `quantity` (numeric)
      - `min_quantity` (numeric)
      - `price_per_unit` (numeric)
      - `category` (text)
      - `location` (text)
      - `is_active` (boolean)
    - `warehouse_transactions` - Stock movements
      - `id` (uuid, PK)
      - `item_id` (uuid, FK to warehouse_items)
      - `project_id` (uuid, FK to projects, nullable)
      - `type` (text: in/out/adjustment)
      - `quantity` (numeric)
      - `note` (text)
      - `created_by` (uuid)
    - `notifications` - User notifications
      - `id` (uuid, PK)
      - `user_id` (uuid)
      - `type` (text)
      - `title` (text)
      - `message` (text)
      - `entity_type` (text, nullable)
      - `entity_id` (uuid, nullable)
      - `is_read` (boolean)
    - `invoices` - Financial invoices
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects, nullable)
      - `client_id` (uuid, FK to clients, nullable)
      - `invoice_number` (text)
      - `status` (text: draft/sent/paid/overdue)
      - `amount` (numeric)
      - `tax_amount` (numeric)
      - `due_date` (date)
      - `paid_at` (timestamptz, nullable)
      - `note` (text)
      - `created_by` (uuid)
    - `payments` - Payment records
      - `id` (uuid, PK)
      - `invoice_id` (uuid, FK to invoices)
      - `amount` (numeric)
      - `method` (text)
      - `note` (text)
      - `paid_at` (timestamptz)
    - `project_photos` - Photo documentation
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects)
      - `phase` (text: before/during/after)
      - `description` (text)
      - `url` (text)
      - `uploaded_by` (uuid)
    - `employee_certifications` - Employee certs
      - `id` (uuid, PK)
      - `profile_id` (uuid, FK to profiles)
      - `name` (text)
      - `issuer` (text)
      - `valid_from` (date)
      - `valid_to` (date, nullable)
      - `document_url` (text)
    - `employee_equipment` - Assigned equipment
      - `id` (uuid, PK)
      - `profile_id` (uuid, FK to profiles)
      - `name` (text)
      - `serial_number` (text)
      - `assigned_at` (date)
      - `returned_at` (date, nullable)
    - `employee_vacations` - Leave requests
      - `id` (uuid, PK)
      - `profile_id` (uuid, FK to profiles)
      - `start_date` (date)
      - `end_date` (date)
      - `type` (text: vacation/sick/personal)
      - `status` (text: pending/approved/rejected)
      - `approved_by` (uuid, nullable)
      - `note` (text)
    - `crm_activities` - CRM activity timeline
      - `id` (uuid, PK)
      - `client_id` (uuid, FK to clients)
      - `type` (text: call/email/meeting/note)
      - `title` (text)
      - `description` (text)
      - `user_id` (uuid)
      - `scheduled_at` (timestamptz, nullable)
      - `completed_at` (timestamptz, nullable)
    - `crm_reminders` - CRM follow-up reminders
      - `id` (uuid, PK)
      - `client_id` (uuid, FK to clients)
      - `user_id` (uuid)
      - `title` (text)
      - `due_date` (date)
      - `is_completed` (boolean)
    - `project_defects` - Execution defects tracking
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects)
      - `title` (text)
      - `description` (text)
      - `severity` (text: low/medium/high/critical)
      - `status` (text: open/in_progress/resolved)
      - `reported_by` (uuid)
      - `assigned_to` (uuid, nullable)
      - `resolved_at` (timestamptz, nullable)
      - `photo_url` (text)
    - `portal_comments` - Client portal comments on quotes
      - `id` (uuid, PK)
      - `project_id` (uuid, FK to projects)
      - `quote_id` (uuid, nullable)
      - `user_id` (uuid)
      - `content` (text)
  2. Security
    - RLS enabled on all tables
    - Policies for authenticated users
*/

-- Project Milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'planned',
  sort_order int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read milestones" ON project_milestones FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert milestones" ON project_milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update milestones" ON project_milestones FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete milestones" ON project_milestones FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES project_milestones(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  due_date date,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tasks" ON tasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update tasks" ON tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete tasks" ON tasks FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Time Entries
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes int NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  billable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read time entries" ON time_entries FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert own time entries" ON time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time entries" ON time_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own time entries" ON time_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Warehouse Items
CREATE TABLE IF NOT EXISTS warehouse_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'ks',
  quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric NOT NULL DEFAULT 0,
  price_per_unit numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read warehouse items" ON warehouse_items FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert warehouse items" ON warehouse_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update warehouse items" ON warehouse_items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete warehouse items" ON warehouse_items FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Warehouse Transactions
CREATE TABLE IF NOT EXISTS warehouse_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'in',
  quantity numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE warehouse_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read warehouse transactions" ON warehouse_transactions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert warehouse transactions" ON warehouse_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update warehouse transactions" ON warehouse_transactions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete warehouse transactions" ON warehouse_transactions FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_id uuid,
  invoice_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read invoices" ON invoices FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update invoices" ON invoices FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete invoices" ON invoices FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'bank_transfer',
  note text NOT NULL DEFAULT '',
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read payments" ON payments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert payments" ON payments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update payments" ON payments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete payments" ON payments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Project Photos
CREATE TABLE IF NOT EXISTS project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'during',
  description text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read project photos" ON project_photos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert project photos" ON project_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Authenticated users can update project photos" ON project_photos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete project photos" ON project_photos FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- Employee Certifications
CREATE TABLE IF NOT EXISTS employee_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  issuer text NOT NULL DEFAULT '',
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  document_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE employee_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read certifications" ON employee_certifications FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert certifications" ON employee_certifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update certifications" ON employee_certifications FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete certifications" ON employee_certifications FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Employee Equipment
CREATE TABLE IF NOT EXISTS employee_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  assigned_at date NOT NULL DEFAULT CURRENT_DATE,
  returned_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE employee_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read equipment" ON employee_equipment FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert equipment" ON employee_equipment FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update equipment" ON employee_equipment FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete equipment" ON employee_equipment FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Employee Vacations
CREATE TABLE IF NOT EXISTS employee_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT 'vacation',
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE employee_vacations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read vacations" ON employee_vacations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert own vacations" ON employee_vacations FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Authenticated users can update vacations" ON employee_vacations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own vacations" ON employee_vacations FOR DELETE TO authenticated USING (auth.uid() = profile_id);

-- CRM Activities
CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'note',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  user_id uuid NOT NULL REFERENCES auth.users(id),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read crm activities" ON crm_activities FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert crm activities" ON crm_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update crm activities" ON crm_activities FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete crm activities" ON crm_activities FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CRM Reminders
CREATE TABLE IF NOT EXISTS crm_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL DEFAULT '',
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read crm reminders" ON crm_reminders FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert crm reminders" ON crm_reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update crm reminders" ON crm_reminders FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete crm reminders" ON crm_reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Project Defects
CREATE TABLE IF NOT EXISTS project_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  reported_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  photo_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE project_defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read defects" ON project_defects FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert defects" ON project_defects FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Authenticated users can update defects" ON project_defects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete defects" ON project_defects FOR DELETE TO authenticated USING (auth.uid() = reported_by);

-- Portal Comments
CREATE TABLE IF NOT EXISTS portal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE portal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read portal comments" ON portal_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert own portal comments" ON portal_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portal comments" ON portal_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own portal comments" ON portal_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_item_id ON warehouse_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_project_photos_project_id ON project_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_client_id ON crm_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_reminders_client_id ON crm_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_project_defects_project_id ON project_defects(project_id);
CREATE INDEX IF NOT EXISTS idx_portal_comments_project_id ON portal_comments(project_id);
