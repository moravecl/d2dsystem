/*
  # Project Files with Folders and Approval Workflow

  1. New Tables
    - `project_folders`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `parent_id` (uuid, nullable, FK to self for nested folders)
      - `name` (text) - folder name
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
    - `project_files`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `folder_id` (uuid, nullable, FK to project_folders)
      - `name` (text) - file display name
      - `description` (text) - optional description
      - `file_url` (text) - storage URL
      - `file_type` (text) - extension
      - `file_size` (bigint) - bytes
      - `requires_approval` (boolean, default false) - needs client approval
      - `approval_status` (text, default 'none') - none, pending, approved, rejected
      - `approved_at` (timestamptz, nullable)
      - `approved_by` (uuid, nullable)
      - `approval_note` (text) - client comment on approval/rejection
      - `portal_visible` (boolean, default false) - visible to client in portal
      - `uploaded_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Authenticated users can CRUD their project files/folders
    - Portal users can read portal_visible files and update approval_status
*/

-- Project Folders
CREATE TABLE IF NOT EXISTS public.project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.project_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project folders"
  ON public.project_folders FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert project folders"
  ON public.project_folders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project folders"
  ON public.project_folders FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project folders"
  ON public.project_folders FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_project_folders_project ON public.project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_parent ON public.project_folders(parent_id);

-- Project Files
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.project_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_type TEXT DEFAULT '',
  file_size BIGINT DEFAULT 0,
  requires_approval BOOLEAN DEFAULT false,
  approval_status TEXT DEFAULT 'none',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approval_note TEXT DEFAULT '',
  portal_visible BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project files"
  ON public.project_files FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert project files"
  ON public.project_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project files"
  ON public.project_files FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project files"
  ON public.project_files FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_folder ON public.project_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_project_files_approval ON public.project_files(approval_status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_project_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_files_updated_at
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_files_updated_at();
