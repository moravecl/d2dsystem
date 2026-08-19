/*
  # Fix attendance sync to include all workers

  1. Changes
    - Update `sync_worklog_to_attendance` function to create attendance records
      for ALL workers listed in the worklog's `workers` JSONB array, not just
      the worklog creator (`user_id`)
    - Each worker gets their own attendance record with correct times
  
  2. Backfill
    - Reprocess all existing job_worklogs to create missing attendance records
      for workers other than the creator
*/

CREATE OR REPLACE FUNCTION sync_worklog_to_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
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
  worker_record jsonb;
  worker_uuid uuid;
  all_worker_ids uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    work_date := OLD.started_at::date;
    proj_id := (SELECT project_id FROM jobs WHERE id = OLD.job_id);
    all_worker_ids := ARRAY[OLD.user_id];
    IF OLD.workers IS NOT NULL AND jsonb_array_length(OLD.workers) > 0 THEN
      FOR worker_record IN SELECT * FROM jsonb_array_elements(OLD.workers)
      LOOP
        IF (worker_record->>'type') = 'employee' AND (worker_record->>'id') IS NOT NULL THEN
          all_worker_ids := array_append(all_worker_ids, (worker_record->>'id')::uuid);
        END IF;
      END LOOP;
    END IF;
    
    FOREACH worker_uuid IN ARRAY all_worker_ids
    LOOP
      DELETE FROM attendance_records
      WHERE employee_id = worker_uuid
        AND date = work_date
        AND project_id = proj_id
        AND notes = 'Automaticky z worklogu';
    END LOOP;
    
    RETURN OLD;
  END IF;

  work_date := NEW.started_at::date;
  proj_id := (SELECT project_id FROM jobs WHERE id = NEW.job_id);

  IF NEW.started_at IS NULL THEN
    RETURN NEW;
  END IF;

  all_worker_ids := ARRAY[NEW.user_id];
  IF NEW.workers IS NOT NULL AND jsonb_array_length(NEW.workers) > 0 THEN
    FOR worker_record IN SELECT * FROM jsonb_array_elements(NEW.workers)
    LOOP
      IF (worker_record->>'type') = 'employee' AND (worker_record->>'id') IS NOT NULL THEN
        worker_uuid := (worker_record->>'id')::uuid;
        IF NOT (worker_uuid = ANY(all_worker_ids)) THEN
          all_worker_ids := array_append(all_worker_ids, worker_uuid);
        END IF;
      END IF;
    END LOOP;
  END IF;

  FOREACH worker_uuid IN ARRAY all_worker_ids
  LOOP
    DELETE FROM attendance_records
    WHERE employee_id = worker_uuid
      AND date = work_date
      AND project_id = proj_id
      AND notes = 'Automaticky z worklogu';

    v_start_time := NEW.started_at::time;
    v_end_time := CASE WHEN NEW.ended_at IS NOT NULL THEN NEW.ended_at::time ELSE NULL END;
    total_minutes := COALESCE(NEW.duration_minutes, 0);
    activity_txt := COALESCE(NULLIF(NEW.activity, ''), 'Práce na projektu');
    break_mins := CASE WHEN total_minutes > 240 THEN 30 ELSE 0 END;

    INSERT INTO attendance_records (
      employee_id, date, start_time, end_time, break_minutes,
      activity_type, project_id, notes
    ) VALUES (
      worker_uuid, work_date, v_start_time, v_end_time, break_mins,
      activity_txt, proj_id, 'Automaticky z worklogu'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  wl record;
  worker_record jsonb;
  worker_uuid uuid;
  all_ids uuid[];
  wid uuid;
  proj_id uuid;
  work_date date;
  v_start time;
  v_end time;
  dur int;
  brk int;
  act text;
BEGIN
  DELETE FROM attendance_records WHERE notes = 'Automaticky z worklogu';

  FOR wl IN SELECT * FROM job_worklogs WHERE started_at IS NOT NULL
  LOOP
    proj_id := (SELECT project_id FROM jobs WHERE id = wl.job_id);
    work_date := wl.started_at::date;
    v_start := wl.started_at::time;
    v_end := CASE WHEN wl.ended_at IS NOT NULL THEN wl.ended_at::time ELSE NULL END;
    dur := COALESCE(wl.duration_minutes, 0);
    brk := CASE WHEN dur > 240 THEN 30 ELSE 0 END;
    act := COALESCE(NULLIF(wl.activity, ''), 'Práce na projektu');

    all_ids := ARRAY[wl.user_id];
    IF wl.workers IS NOT NULL AND jsonb_array_length(wl.workers) > 0 THEN
      FOR worker_record IN SELECT * FROM jsonb_array_elements(wl.workers)
      LOOP
        IF (worker_record->>'type') = 'employee' AND (worker_record->>'id') IS NOT NULL THEN
          worker_uuid := (worker_record->>'id')::uuid;
          IF NOT (worker_uuid = ANY(all_ids)) THEN
            all_ids := array_append(all_ids, worker_uuid);
          END IF;
        END IF;
      END LOOP;
    END IF;

    FOREACH wid IN ARRAY all_ids
    LOOP
      INSERT INTO attendance_records (
        employee_id, date, start_time, end_time, break_minutes,
        activity_type, project_id, notes
      ) VALUES (
        wid, work_date, v_start, v_end, brk,
        act, proj_id, 'Automaticky z worklogu'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
