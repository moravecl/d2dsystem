/*
  # Fix org_id trigger for project_design_elements

  ## Problem
  The trigger function `fill_org_id_from_project` references `projects.org_id` but the column
  is actually named `organization_id` in the projects table.

  ## Solution
  Update the trigger function to use the correct column name.
*/

CREATE OR REPLACE FUNCTION fill_org_id_from_project()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.org_id FROM projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;