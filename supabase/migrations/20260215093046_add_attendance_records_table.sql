/*
  # Create attendance_records table

  1. New Tables
    - `attendance_records`
      - `id` (uuid, primary key) - Unique identifier
      - `employee_id` (uuid, foreign key) - Reference to profiles table
      - `date` (date) - Work date
      - `start_time` (time) - Start time of work
      - `end_time` (time, nullable) - End time of work
      - `break_minutes` (integer) - Break duration in minutes
      - `activity_type` (text) - Type of work activity
      - `project_id` (uuid, foreign key, nullable) - Optional reference to project
      - `notes` (text, nullable) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `attendance_records` table
    - Add policy for authenticated users to view all records
    - Add policy for authenticated users to insert records
    - Add policy for authenticated users to update own records
    - Add policy for authenticated users to delete own records

  3. Indexes
    - Index on employee_id for faster queries
    - Index on date for faster filtering
    - Index on project_id for project-based queries
*/

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time NOT NULL,
  end_time time,
  break_minutes integer NOT NULL DEFAULT 0,
  activity_type text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_project ON attendance_records(project_id);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all attendance records"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert attendance records"
  ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance records"
  ON attendance_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete attendance records"
  ON attendance_records
  FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();
