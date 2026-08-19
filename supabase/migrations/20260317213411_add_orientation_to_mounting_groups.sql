/*
  # Add orientation column to mounting_groups

  1. Changes
    - Add `orientation` column to `mounting_groups` table
    - Supports values: 'horizontal', 'vertical'
    - Default value: 'horizontal'

  2. Purpose
    - Enables multi-frame groups to be oriented horizontally or vertically
    - Essential for proper frame calculation and visual rendering
*/

ALTER TABLE mounting_groups
ADD COLUMN IF NOT EXISTS orientation text NOT NULL DEFAULT 'horizontal'
CHECK (orientation IN ('horizontal', 'vertical'));