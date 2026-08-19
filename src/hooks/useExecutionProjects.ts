import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ExecutionProject {
  id: string;
  project_name: string;
  client_name: string;
  status: string;
  address: string;
  deadline: string | null;
  responsible_user_id: string | null;
  montaz_start_date: string | null;
  execution_started_at: string | null;
  updated_at: string;
  job_id: string | null;
  job_status: string | null;
  job_started_at: string | null;
  total_work_minutes: number;
  active_timers: number;
  planned_material_cost: number;
  actual_material_cost: number;
  unplanned_materials: number;
  diary_entries: number;
  last_diary_date: string | null;
  open_defects: number;
  total_defects: number;
  total_tasks: number;
  completed_tasks: number;
  approved_budget: number;
  pending_extras: number;
  responsible_name: string;
  responsible_email: string;
}

export function useExecutionProjects() {
  const [projects, setProjects] = useState<ExecutionProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: rawProjects } = await supabase
        .from('projects')
        .select('id, project_name, client_name, status, address, deadline, responsible_user_id, montaz_start_date, execution_started_at, updated_at')
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false });

      if (!rawProjects || rawProjects.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projectIds = rawProjects.map(p => p.id);

      const [
        jobsRes,
        defectsRes,
        tasksRes,
        quotesRes,
        extrasRes,
        profilesRes,
      ] = await Promise.all([
        supabase.from('jobs').select('id, project_id, status, started_at').in('project_id', projectIds),
        supabase.from('project_defects').select('id, project_id, status').in('project_id', projectIds),
        supabase.from('tasks').select('id, project_id, status').in('project_id', projectIds),
        supabase.from('project_quotes').select('id, project_id, total_selling, status').in('project_id', projectIds).eq('status', 'approved'),
        supabase.from('execution_viceprace').select('id, project_id, approved').in('project_id', projectIds),
        supabase.from('profiles').select('id, display_name, email'),
      ]);

      const jobs = jobsRes.data || [];
      const defects = defectsRes.data || [];
      const tasks = tasksRes.data || [];
      const quotes = quotesRes.data || [];
      const extras = extrasRes.data || [];
      const profiles = profilesRes.data || [];

      const jobIds = jobs.map(j => j.id);

      const [worklogsRes, materialsRes, diaryRes] = jobIds.length > 0
        ? await Promise.all([
            supabase.from('job_worklogs').select('id, job_id, duration_minutes, is_running').in('job_id', jobIds),
            supabase.from('job_material_entries').select('id, job_id, planned_qty, actual_qty, unit_price, is_unplanned').in('job_id', jobIds),
            supabase.from('job_diary_entries').select('id, job_id, entry_date').in('job_id', jobIds),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];

      const worklogs = worklogsRes.data || [];
      const materials = materialsRes.data || [];
      const diary = diaryRes.data || [];

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const enriched: ExecutionProject[] = rawProjects.map(p => {
        const projectJobs = jobs.filter(j => j.project_id === p.id);
        const job = projectJobs[0] || null;
        const jobId = job?.id;

        const projectWorklogs = jobId ? worklogs.filter(w => w.job_id === jobId) : [];
        const projectMaterials = jobId ? materials.filter(m => m.job_id === jobId) : [];
        const projectDiary = jobId ? diary.filter(d => d.job_id === jobId) : [];
        const projectDefects = defects.filter(d => d.project_id === p.id);
        const projectTasks = tasks.filter(t => t.project_id === p.id);
        const projectQuotes = quotes.filter(q => q.project_id === p.id);
        const projectExtras = extras.filter(e => e.project_id === p.id);

        const profile = p.responsible_user_id ? profileMap.get(p.responsible_user_id) : null;

        return {
          id: p.id,
          project_name: p.project_name,
          client_name: p.client_name,
          status: p.status,
          address: p.address,
          deadline: p.deadline,
          responsible_user_id: p.responsible_user_id,
          montaz_start_date: p.montaz_start_date,
          execution_started_at: p.execution_started_at,
          updated_at: p.updated_at,
          job_id: jobId || null,
          job_status: job?.status || null,
          job_started_at: job?.started_at || null,
          total_work_minutes: projectWorklogs.reduce((sum, w) => sum + (w.duration_minutes || 0), 0),
          active_timers: projectWorklogs.filter(w => w.is_running).length,
          planned_material_cost: projectMaterials.reduce((sum, m) => sum + (m.planned_qty || 0) * (m.unit_price || 0), 0),
          actual_material_cost: projectMaterials.reduce((sum, m) => sum + (m.actual_qty || 0) * (m.unit_price || 0), 0),
          unplanned_materials: projectMaterials.filter(m => m.is_unplanned).length,
          diary_entries: projectDiary.length,
          last_diary_date: projectDiary.length > 0
            ? projectDiary.sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0].entry_date
            : null,
          open_defects: projectDefects.filter(d => d.status === 'open').length,
          total_defects: projectDefects.length,
          total_tasks: projectTasks.length,
          completed_tasks: projectTasks.filter(t => t.status === 'done').length,
          approved_budget: projectQuotes.reduce((sum, q) => sum + (q.total_selling || 0), 0),
          pending_extras: projectExtras.filter(e => !e.approved).length,
          responsible_name: profile?.display_name || '',
          responsible_email: profile?.email || '',
        };
      });

      setProjects(enriched);
      setLoading(false);
    }

    load();
  }, []);

  return { projects, loading };
}
