/*
  # Synchronize job worklogs to attendance records

  1. Function
    - Create function to sync job_worklogs to attendance_records
    - Automatically create or update attendance_records when worklog is inserted or updated
    - Aggregates all worklogs for the same employee on the same day
    
  2. Triggers
    - Trigger after INSERT on job_worklogs
    - Trigger after UPDATE on job_worklogs
    - Trigger after DELETE on job_worklogs
    
  3. Notes
    - Multiple worklogs per day are aggregated into single attendance record
    - Break time defaults to 30 minutes for full work days (>4 hours)
    - Activity type extracted from job context or worklog activity
*/

-- Function to sync worklog to attendance
CREATE OR REPLACE FUNCTION sync_worklog_to_attendance()
RETURNS TRIGGER AS $$
DECLARE
  work_date date;
  start_time time;
  end_time time;
  total_minutes int;
  break_mins int;
  activity_txt text;
  proj_id uuid;
  emp_id uuid;
BEGIN
  -- Determine employee id and work details
  IF TG_OP = 'DELETE' THEN
    emp_id := OLD.user_id;
    work_date := OLD.started_at::date;
    proj_id := (SELECT project_id FROM jobs WHERE id = OLD.job_id);
  ELSE
    emp_id := NEW.user_id;
    work_date := NEW.started_at::date;
    proj_id := (SELECT project_id FROM jobs WHERE id = NEW.job_id);
  END IF;

  -- Skip if no started_at or user_id
  IF emp_id IS NULL OR (TG_OP != 'DELETE' AND NEW.started_at IS NULL) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Delete and recalculate attendance for this day
  DELETE FROM attendance_records 
  WHERE employee_id = emp_id 
    AND date = work_date 
    AND project_id = proj_id;

  -- Aggregate all worklogs for this employee on this date
  SELECT 
    MIN(started_at::time),
    MAX(CASE WHEN ended_at IS NOT NULL THEN ended_at::time ELSE NULL END),
    COALESCE(SUM(duration_minutes), 0),
    STRING_AGG(DISTINCT activity, ', ')
  INTO start_time, end_time, total_minutes, activity_txt
  FROM job_worklogs wl
  JOIN jobs j ON j.id = wl.job_id
  WHERE wl.user_id = emp_id
    AND wl.started_at::date = work_date
    AND j.project_id = proj_id
    AND wl.started_at IS NOT NULL;

  -- Only create attendance if we have data
  IF start_time IS NOT NULL THEN
    -- Calculate break time (30 min for >4 hours of work)
    break_mins := CASE WHEN total_minutes > 240 THEN 30 ELSE 0 END;
    
    -- Default activity if none specified
    IF activity_txt IS NULL OR activity_txt = '' THEN
      activity_txt := 'Práce na projektu';
    END IF;

    -- Insert attendance record
    INSERT INTO attendance_records (
      employee_id,
      date,
      start_time,
      end_time,
      break_minutes,
      activity_type,
      project_id,
      notes
    ) VALUES (
      emp_id,
      work_date,
      start_time,
      end_time,
      break_mins,
      activity_txt,
      proj_id,
      'Automaticky z worklogu'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS sync_worklog_insert ON job_worklogs;
CREATE TRIGGER sync_worklog_insert
  AFTER INSERT ON job_worklogs
  FOR EACH ROW
  EXECUTE FUNCTION sync_worklog_to_attendance();

DROP TRIGGER IF EXISTS sync_worklog_update ON job_worklogs;
CREATE TRIGGER sync_worklog_update
  AFTER UPDATE ON job_worklogs
  FOR EACH ROW
  WHEN (OLD.started_at IS DISTINCT FROM NEW.started_at 
    OR OLD.ended_at IS DISTINCT FROM NEW.ended_at 
    OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
    OR OLD.activity IS DISTINCT FROM NEW.activity)
  EXECUTE FUNCTION sync_worklog_to_attendance();

DROP TRIGGER IF EXISTS sync_worklog_delete ON job_worklogs;
CREATE TRIGGER sync_worklog_delete
  AFTER DELETE ON job_worklogs
  FOR EACH ROW
  EXECUTE FUNCTION sync_worklog_to_attendance();
