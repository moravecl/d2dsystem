/*
  # Create Events, Knowledge Zone, and News Wall schema

  1. New Tables
    - `event_types` - Custom event type definitions per organization
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `name` (text) - e.g., "Schuzka", "Skoleni"
      - `color` (text) - Tailwind color class
      - `icon` (text) - icon identifier
      - `is_active` (boolean)
      - `sort_order` (integer)
    - `events` - Calendar/scheduling events
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `title` (text)
      - `description` (text)
      - `event_type_id` (uuid, FK to event_types)
      - `start_date` (date)
      - `start_time` (time)
      - `end_date` (date)
      - `end_time` (time)
      - `all_day` (boolean)
      - `location` (text)
      - `project_id` (uuid, FK to projects, nullable)
      - `created_by` (uuid, FK to auth.users)
      - `attendees` (uuid array - user IDs)
      - `reminder_minutes` (integer, nullable) - e.g., 60 = 1 hour before
      - `notes` (text)
      - `created_at`, `updated_at`
    - `knowledge_categories` - Categories for knowledge files
      - `id` (uuid, primary key)
      - `organization_id` (uuid)
      - `name` (text)
      - `color` (text)
      - `sort_order` (integer)
      - `is_active` (boolean)
    - `knowledge_files` - File repository (PDFs, documents)
      - `id` (uuid, primary key)
      - `organization_id` (uuid)
      - `category_id` (uuid, FK to knowledge_categories, nullable)
      - `title` (text)
      - `description` (text)
      - `file_name` (text)
      - `file_url` (text)
      - `file_size` (bigint)
      - `mime_type` (text)
      - `uploaded_by` (uuid)
      - `tags` (text array)
      - `is_pinned` (boolean)
      - `download_count` (integer)
      - `created_at`, `updated_at`
    - `news_posts` - Internal news / information wall
      - `id` (uuid, primary key)
      - `organization_id` (uuid)
      - `author_id` (uuid)
      - `title` (text)
      - `content` (text)
      - `category` (text) - oznameni / novinka / tip / dulezite
      - `is_pinned` (boolean)
      - `is_published` (boolean)
      - `publish_date` (date)
      - `created_at`, `updated_at`
    - `news_comments` - Comments on news posts
      - `id` (uuid, primary key)
      - `news_post_id` (uuid, FK)
      - `author_id` (uuid)
      - `content` (text)
      - `created_at`

  2. Security
    - RLS enabled on all tables
    - Org-scoped read access for authenticated members
    - Write access for creators and admins
*/

-- Event Types (codebook)
CREATE TABLE IF NOT EXISTS event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'bg-blue-100 text-blue-700',
  icon text NOT NULL DEFAULT 'calendar',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view event types"
  ON event_types FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert event types"
  ON event_types FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "Admins can update event types"
  ON event_types FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "Admins can delete event types"
  ON event_types FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

-- Events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  event_type_id uuid REFERENCES event_types(id) ON DELETE SET NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  end_time time,
  all_day boolean NOT NULL DEFAULT false,
  location text NOT NULL DEFAULT '',
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attendees uuid[] NOT NULL DEFAULT '{}',
  reminder_minutes integer,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view events"
  ON events FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators and admins can update events"
  ON events FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','manager')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','manager')
    )
  );

CREATE POLICY "Creators and admins can delete events"
  ON events FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','manager')
    )
  );

-- Knowledge Categories
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'bg-slate-100 text-slate-700',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view knowledge categories"
  ON knowledge_categories FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert knowledge categories"
  ON knowledge_categories FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "Admins can update knowledge categories"
  ON knowledge_categories FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "Admins can delete knowledge categories"
  ON knowledge_categories FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

-- Knowledge Files
CREATE TABLE IF NOT EXISTS knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  is_pinned boolean NOT NULL DEFAULT false,
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view knowledge files"
  ON knowledge_files FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can upload knowledge files"
  ON knowledge_files FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Uploaders and admins can update knowledge files"
  ON knowledge_files FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "Uploaders and admins can delete knowledge files"
  ON knowledge_files FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

-- News Posts
CREATE TABLE IF NOT EXISTS news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'novinka',
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  publish_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view published news"
  ON news_posts FOR SELECT TO authenticated
  USING (
    is_published = true
    AND organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert news posts"
  ON news_posts FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','manager')
    )
  );

CREATE POLICY "Authors and admins can update news posts"
  ON news_posts FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "Authors and admins can delete news posts"
  ON news_posts FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    )
  );

-- News Comments
CREATE TABLE IF NOT EXISTS news_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_post_id uuid REFERENCES news_posts(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view news comments"
  ON news_comments FOR SELECT TO authenticated
  USING (
    news_post_id IN (
      SELECT np.id FROM news_posts np
      WHERE np.is_published = true
      AND np.organization_id IN (
        SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can add comments"
  ON news_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND news_post_id IN (
      SELECT np.id FROM news_posts np
      WHERE np.is_published = true
      AND np.organization_id IN (
        SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authors can update own comments"
  ON news_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors and admins can delete comments"
  ON news_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR news_post_id IN (
      SELECT np.id FROM news_posts np
      WHERE np.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
      )
    )
  );

-- Auto-set organization_id triggers
CREATE OR REPLACE FUNCTION set_org_id_from_member()
RETURNS trigger AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT om.organization_id INTO NEW.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_event_types_org_id') THEN
    CREATE TRIGGER set_event_types_org_id BEFORE INSERT ON event_types
      FOR EACH ROW EXECUTE FUNCTION set_org_id_from_member();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_events_org_id') THEN
    CREATE TRIGGER set_events_org_id BEFORE INSERT ON events
      FOR EACH ROW EXECUTE FUNCTION set_org_id_from_member();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_knowledge_categories_org_id') THEN
    CREATE TRIGGER set_knowledge_categories_org_id BEFORE INSERT ON knowledge_categories
      FOR EACH ROW EXECUTE FUNCTION set_org_id_from_member();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_knowledge_files_org_id') THEN
    CREATE TRIGGER set_knowledge_files_org_id BEFORE INSERT ON knowledge_files
      FOR EACH ROW EXECUTE FUNCTION set_org_id_from_member();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_news_posts_org_id') THEN
    CREATE TRIGGER set_news_posts_org_id BEFORE INSERT ON news_posts
      FOR EACH ROW EXECUTE FUNCTION set_org_id_from_member();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_org_id ON knowledge_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_category_id ON knowledge_files(category_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_org_id ON news_posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_publish_date ON news_posts(publish_date);
CREATE INDEX IF NOT EXISTS idx_news_comments_post_id ON news_comments(news_post_id);
