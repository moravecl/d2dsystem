/*
  # Custom Fields & Project Templates

  1. New Tables

    ## Custom Fields System
    - `custom_field_definitions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `name` (text) - internal name / label shown in UI
      - `field_type` (text) - 'text', 'number', 'date', 'select', 'checkbox', 'textarea', 'url', 'email'
      - `options` (jsonb) - for 'select' type: array of option strings
      - `is_required` (boolean) - whether the field is mandatory
      - `section` (text) - grouping label for organizing fields into sections
      - `position` (integer) - sort order within section
      - `is_active` (boolean) - soft delete / deactivation
      - `created_at` (timestamptz)

    - `custom_field_values`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `field_id` (uuid, FK to custom_field_definitions)
      - `value` (text) - the stored value as text (parsed by field_type)
      - `organization_id` (uuid, FK to organizations)
      - `updated_at` (timestamptz)

    ## Project Templates System
    - `project_templates`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `name` (text) - template name
      - `description` (text) - what this template is for
      - `default_status` (text) - initial project status
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `template_milestones`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to project_templates)
      - `name` (text)
      - `offset_days` (integer) - days offset from project start
      - `duration_days` (integer) - milestone duration
      - `color` (text)
      - `sort_order` (integer)

    - `template_tasks`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to project_templates)
      - `milestone_index` (integer) - references sort_order of template_milestones (-1 = no milestone)
      - `title` (text)
      - `description` (text)
      - `priority` (text)
      - `sort_order` (integer)

    - `template_custom_fields`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to project_templates)
      - `field_id` (uuid, FK to custom_field_definitions)
      - `default_value` (text) - optional default value for this field in template

  2. Security
    - RLS enabled on all tables
    - Organization members can read
    - Admins/owners can insert, update, delete
    - custom_field_values: project-scoped access for authenticated org members

  3. Notes
    - Custom fields are defined per organization and apply to all projects in that org
    - Templates bundle milestones, tasks, and custom field defaults
    - When a template is applied, milestones/tasks are created with dates offset from project creation date
*/

-- Custom Field Definitions
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  field_type text NOT NULL DEFAULT 'text',
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  section text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read custom field definitions"
  ON custom_field_definitions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_definitions.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert custom field definitions"
  ON custom_field_definitions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_definitions.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can update custom field definitions"
  ON custom_field_definitions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_definitions.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_definitions.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can delete custom field definitions"
  ON custom_field_definitions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_definitions.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

-- Custom Field Values
CREATE TABLE IF NOT EXISTS custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  field_id uuid REFERENCES custom_field_definitions(id) ON DELETE CASCADE NOT NULL,
  value text NOT NULL DEFAULT '',
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, field_id)
);

ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read custom field values"
  ON custom_field_values FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_values.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert custom field values"
  ON custom_field_values FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_values.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update custom field values"
  ON custom_field_values FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_values.organization_id AND om.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_values.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete custom field values"
  ON custom_field_values FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_field_values.organization_id AND om.user_id = auth.uid()
  ));

-- Project Templates
CREATE TABLE IF NOT EXISTS project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  default_status text NOT NULL DEFAULT 'lead',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read project templates"
  ON project_templates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = project_templates.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert project templates"
  ON project_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = project_templates.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can update project templates"
  ON project_templates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = project_templates.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = project_templates.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can delete project templates"
  ON project_templates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = project_templates.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

-- Template Milestones
CREATE TABLE IF NOT EXISTS template_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  offset_days integer NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 7,
  color text NOT NULL DEFAULT '#3b82f6',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE template_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read template milestones"
  ON template_milestones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_milestones.template_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert template milestones"
  ON template_milestones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_milestones.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can update template milestones"
  ON template_milestones FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_milestones.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_milestones.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can delete template milestones"
  ON template_milestones FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_milestones.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

-- Template Tasks
CREATE TABLE IF NOT EXISTS template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE NOT NULL,
  milestone_index integer NOT NULL DEFAULT -1,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read template tasks"
  ON template_tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_tasks.template_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert template tasks"
  ON template_tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_tasks.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can update template tasks"
  ON template_tasks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_tasks.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_tasks.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can delete template tasks"
  ON template_tasks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_tasks.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

-- Template Custom Fields (which fields + default values the template pre-fills)
CREATE TABLE IF NOT EXISTS template_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE NOT NULL,
  field_id uuid REFERENCES custom_field_definitions(id) ON DELETE CASCADE NOT NULL,
  default_value text NOT NULL DEFAULT '',
  UNIQUE(template_id, field_id)
);

ALTER TABLE template_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read template custom fields"
  ON template_custom_fields FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_custom_fields.template_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert template custom fields"
  ON template_custom_fields FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_custom_fields.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can update template custom fields"
  ON template_custom_fields FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_custom_fields.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_custom_fields.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));

CREATE POLICY "Admins can delete template custom fields"
  ON template_custom_fields FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM project_templates pt
    JOIN organization_members om ON om.organization_id = pt.organization_id
    WHERE pt.id = template_custom_fields.template_id AND om.user_id = auth.uid() AND om.role IN ('admin','owner')
  ));
