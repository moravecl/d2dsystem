/*
  # Extend resource_groups to full dispatcher model

  ## Changes

  ### resource_groups
  - Widens `type` CHECK constraint to include all dispatcher-relevant categories:
    installation_team, service_team, design_team, individual, vehicle, equipment, external
  - Adds `is_active` boolean (default true) — soft-delete / hide from planner
  - Adds `capacity_hours_per_day` numeric (default 8) — for load calculations
  - Adds `notes` text — free-form description / notes for admins
  - Adds `sort_order` integer (default 0) — controls display order in planner rows

  ## Notes
  - All changes are additive (ALTER ADD COLUMN / DROP CONSTRAINT + ADD CONSTRAINT)
  - Existing data is preserved
*/

ALTER TABLE resource_groups
  DROP CONSTRAINT IF EXISTS resource_groups_type_check;

ALTER TABLE resource_groups
  ADD CONSTRAINT resource_groups_type_check
    CHECK (type IN (
      'installation_team',
      'service_team',
      'design_team',
      'individual',
      'vehicle',
      'equipment',
      'external',
      'installation',
      'service',
      'design',
      'other'
    ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_groups' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE resource_groups ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_groups' AND column_name = 'capacity_hours_per_day'
  ) THEN
    ALTER TABLE resource_groups ADD COLUMN capacity_hours_per_day numeric(4,1) NOT NULL DEFAULT 8;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_groups' AND column_name = 'notes'
  ) THEN
    ALTER TABLE resource_groups ADD COLUMN notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_groups' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE resource_groups ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;
