/*
  # Fix attendance sync trigger and backfill existing data

  1. Changes
    - Recreate sync function with SECURITY DEFINER to bypass RLS
    - Backfill existing job_worklogs into attendance_records
    
  2. Notes
    - SECURITY DEFINER ensures trigger can insert into attendance_records
    - Backfill runs once for all existing worklogs
*/

-- Recreate function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION sync_worklog_to_attendance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  work_date date;
  v_start_time time;
  v_end_time time;
  total_minutes int;
  break_mins int;
  activity_txt text;
  proj_id uuid;
  emp_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    emp_id := OLD.user_id;
    work_date := OLD.started_at::date;
    proj_id := (SELECT project_id FROM jobs WHERE id = OLD.job_id);
  ELSE
    emp_id := NEW.user_id;
    work_date := NEW.started_at::date;
    proj_id := (SELECT project_id FROM jobs WHERE id = NEW.job_id);
  END IF;

  IF emp_id IS NULL OR (TG_OP != 'DELETE' AND NEW.started_at IS NULL) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  DELETE FROM attendance_records 
  WHERE employee_id = emp_id 
    AND date = work_date 
    AND project_id = proj_id;

  SELECT 
    MIN(wl.started_at::time),
    MAX(CASE WHEN wl.ended_at IS NOT NULL THEN wl.ended_at::time ELSE NULL END),
    COALESCE(SUM(wl.duration_minutes), 0),
    STRING_AGG(DISTINCT wl.activity, ', ')
  INTO v_start_time, v_end_time, total_minutes, activity_txt
  FROM job_worklogs wl
  JOIN jobs j ON j.id = wl.job_id
  WHERE wl.user_id = emp_id
    AND wl.started_at::date = work_date
    AND j.project_id = proj_id
    AND wl.started_at IS NOT NULL;

  IF v_start_time IS NOT NULL THEN
    break_mins := CASE WHEN total_minutes > 240 THEN 30 ELSE 0 END;
    
    IF activity_txt IS NULL OR activity_txt = '' THEN
      activity_txt := 'Práce na projektu';
    END IF;

    INSERT INTO attendance_records (
      employee_id, date, start_time, end_time, break_minutes,
      activity_type, project_id, notes
    ) VALUES (
      emp_id, work_date, v_start_time, v_end_time, break_mins,
      activity_txt, proj_id, 'Automaticky z worklogu'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Backfill existing worklogs into attendance_records
INSERT INTO attendance_records (employee_id, date, start_time, end_time, break_minutes, activity_type, project_id, notes)
SELECT 
  wl.user_id,
  wl.started_at::date,
  MIN(wl.started_at::time),
  MAX(CASE WHEN wl.ended_at IS NOT NULL THEN wl.ended_at::time ELSE NULL END),
  CASE WHEN COALESCE(SUM(wl.duration_minutes), 0) > 240 THEN 30 ELSE 0 END,
  STRING_AGG(DISTINCT wl.activity, ', '),
  j.project_id,
  'Automaticky z worklogu'
FROM job_worklogs wl
JOIN jobs j ON j.id = wl.job_id
WHERE wl.started_at IS NOT NULL
GROUP BY wl.user_id, wl.started_at::date, j.project_id
ON CONFLICT DO NOTHING;
