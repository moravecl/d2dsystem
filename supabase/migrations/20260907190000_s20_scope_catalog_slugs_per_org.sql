/*
  # S20: Slug unikátní per organizace (categories, heating_systems)

  Globální UNIQUE na `categories.slug` a `heating_systems.slug` pochází
  z doby před multi-tenancy a brání dvěma organizacím mít stejný katalog
  (např. klon ceníku do demo organizace). Aplikace pracuje s ID; slug se
  porovnává jen v rámci jedné organizace (FilterBar, HeatingSection),
  takže správný invariant je UNIQUE(organization_id, slug).
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_slug_key' AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_slug_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'heating_systems_slug_key' AND conrelid = 'heating_systems'::regclass
  ) THEN
    ALTER TABLE heating_systems DROP CONSTRAINT heating_systems_slug_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_org_slug
  ON categories (organization_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS uq_heating_systems_org_slug
  ON heating_systems (organization_id, slug);
