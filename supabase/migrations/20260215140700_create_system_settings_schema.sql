-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create task_statuses table
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create project_statuses table
CREATE TABLE IF NOT EXISTS public.project_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default task statuses
INSERT INTO public.task_statuses (key, label, color, sort_order, is_active)
VALUES
  ('todo', 'K vyřízení', '#64748b', 1, true),
  ('in_progress', 'Rozpracováno', '#3b82f6', 2, true),
  ('done', 'Hotovo', '#10b981', 3, true),
  ('blocked', 'Blokováno', '#ef4444', 4, true)
ON CONFLICT (key) DO NOTHING;

-- Seed default project statuses
INSERT INTO public.project_statuses (key, label, color, sort_order, is_active)
VALUES
  ('draft', 'Koncept', '#64748b', 1, true),
  ('quote', 'Nabídka', '#06b6d4', 2, true),
  ('approval', 'Schválení', '#f59e0b', 3, true),
  ('execution', 'Realizace', '#10b981', 4, true),
  ('done', 'Dokončeno', '#22c55e', 5, true),
  ('cancelled', 'Zrušeno', '#ef4444', 6, true)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS on system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on task_statuses
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

-- Enable RLS on project_statuses
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_settings
-- Allow authenticated users to read settings
CREATE POLICY "Allow authenticated users to read system settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to update settings
CREATE POLICY "Allow admins to update system settings"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for task_statuses
-- Allow authenticated users to read task statuses
CREATE POLICY "Allow authenticated users to read task statuses"
  ON public.task_statuses
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage task statuses
CREATE POLICY "Allow admins to manage task statuses"
  ON public.task_statuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for project_statuses
-- Allow authenticated users to read project statuses
CREATE POLICY "Allow authenticated users to read project statuses"
  ON public.project_statuses
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage project statuses
CREATE POLICY "Allow admins to manage project statuses"
  ON public.project_statuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_task_statuses_key ON public.task_statuses(key);
CREATE INDEX IF NOT EXISTS idx_task_statuses_sort_order ON public.task_statuses(sort_order);
CREATE INDEX IF NOT EXISTS idx_project_statuses_key ON public.project_statuses(key);
CREATE INDEX IF NOT EXISTS idx_project_statuses_sort_order ON public.project_statuses(sort_order);

-- Add updated_at trigger for system_settings
CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_system_settings_updated_at();

-- Add updated_at trigger for task_statuses
CREATE OR REPLACE FUNCTION public.update_task_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_statuses_updated_at
  BEFORE UPDATE ON public.task_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_statuses_updated_at();

-- Add updated_at trigger for project_statuses
CREATE OR REPLACE FUNCTION public.update_project_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_statuses_updated_at
  BEFORE UPDATE ON public.project_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_statuses_updated_at();