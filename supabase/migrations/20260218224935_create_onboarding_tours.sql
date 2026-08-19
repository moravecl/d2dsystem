/*
  # Create Onboarding Tours

  1. New Tables
    - `onboarding_progress` – tracks which tour steps each user has completed
      - `id` (uuid, pk)
      - `user_id` (uuid, fk profiles)
      - `tour_id` (text) – identifies a specific tour
      - `completed_steps` (text[]) – array of completed step IDs
      - `finished` (boolean) – tour fully completed
      - `skipped` (boolean) – user skipped the tour
      - `created_at`, `updated_at`

  2. New columns on organizations
    - `onboarding_tours_enabled` (boolean DEFAULT true) – admin toggle

  3. Security
    - RLS enabled on onboarding_progress
    - Users can only read/write their own progress
*/

-- Add toggle column to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'onboarding_tours_enabled'
  ) THEN
    ALTER TABLE organizations ADD COLUMN onboarding_tours_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Create onboarding progress table
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tour_id text NOT NULL,
  completed_steps text[] NOT NULL DEFAULT '{}',
  finished boolean NOT NULL DEFAULT false,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tour_id)
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding progress"
  ON onboarding_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding progress"
  ON onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding progress"
  ON onboarding_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
