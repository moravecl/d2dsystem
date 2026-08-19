/*
  # Document Audit Trail & Folder Visibility Settings

  1. New Tables
    - `document_audit_log`
      - `id` (uuid, primary key)
      - `file_id` (uuid, FK to project_files)
      - `project_id` (uuid, FK to projects)
      - `action` (text) - upload, approve, reject, resend, portal_show, portal_hide, delete
      - `performed_by` (uuid, FK to auth.users)
      - `performer_name` (text) - cached display name
      - `note` (text) - optional note
      - `old_status` (text) - previous approval_status
      - `new_status` (text) - new approval_status
      - `created_at` (timestamptz)

  2. Modified Tables
    - `project_folders`
      - `portal_visible` (boolean, default false) - show folder in client portal
      - `visible_to_roles` (text[], default '{admin}') - which roles can see: admin, manager, employee, user

  3. Security
    - RLS enabled on document_audit_log
    - Authenticated users can read/insert audit entries
*/

-- Document Audit Log
CREATE TABLE IF NOT EXISTS public.document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.project_files(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT '',
  performed_by UUID REFERENCES auth.users(id),
  performer_name TEXT DEFAULT '',
  note TEXT DEFAULT '',
  old_status TEXT DEFAULT '',
  new_status TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read document audit log"
  ON public.document_audit_log FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert document audit log"
  ON public.document_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_document_audit_file ON public.document_audit_log(file_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_project ON public.document_audit_log(project_id);

-- Add visibility columns to project_folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_folders' AND column_name = 'portal_visible'
  ) THEN
    ALTER TABLE public.project_folders ADD COLUMN portal_visible BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_folders' AND column_name = 'visible_to_roles'
  ) THEN
    ALTER TABLE public.project_folders ADD COLUMN visible_to_roles TEXT[] DEFAULT '{admin,manager,employee,user}';
  END IF;
END $$;
