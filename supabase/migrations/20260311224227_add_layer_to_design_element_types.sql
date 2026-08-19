/*
  # Add layer column to design_element_types

  ## Summary
  Adds a `layer` column to the `design_element_types` table to support layer-based
  visibility toggling in the design editor. Elements can be assigned to layers
  (e.g., elektro, camera, eps, data, hvac) and users can show/hide entire layers.

  ## Changes
  - `layer` (text): The layer this element type belongs to for visibility grouping.
    Defaults to the category value for backwards compatibility.
*/

ALTER TABLE design_element_types
  ADD COLUMN IF NOT EXISTS layer text;

UPDATE design_element_types
SET layer = category
WHERE layer IS NULL;