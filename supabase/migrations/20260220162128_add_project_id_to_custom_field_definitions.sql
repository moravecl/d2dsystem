/*
  # Add project-specific custom fields support

  1. Changes
    - Add `project_id` nullable column to `custom_field_definitions`
    - When `project_id` is NULL, the field is global (visible in all projects)
    - When `project_id` references a specific project, the field is only visible in that project
    - This allows users to add individual fields per project from within the project detail

  2. Notes
    - Existing fields remain global (project_id = NULL)
    - No data loss: purely additive change
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_field_definitions' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE custom_field_definitions ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;
