import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ResourceGroup, InstallationJob } from '../pages/calendar/calendarTypes';
import { getWeekStart, addDays, dateToStr } from '../pages/calendar/calendarTypes';

interface InstallationDataResult {
  groups: ResourceGroup[];
  jobs: InstallationJob[];
  unplannedJobs: InstallationJob[];
  loading: boolean;
  refresh: () => void;
}

function detectJobType(project: any): InstallationJob['job_type'] {
  const name = (project.project_name || '').toLowerCase();
  if (name.includes('servis') || name.includes('service')) return 'service';
  if (name.includes('revize') || name.includes('revision')) return 'revision';
  if (name.includes('montáž') || name.includes('montaz') || name.includes('instalace') || name.includes('fve')) return 'montaz';
  return 'montaz';
}

export function useInstallationData(weekDate: Date): InstallationDataResult {
  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const [jobs, setJobs] = useState<InstallationJob[]>([]);
  const [unplannedJobs, setUnplannedJobs] = useState<InstallationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ws = getWeekStart(weekDate);
      const we = addDays(ws, 6);
      const firstDay = dateToStr(ws);
      const lastDay = dateToStr(we);

      const { data: groupsRaw } = await supabase
        .from('resource_groups')
        .select('id, name, color, type, is_active, capacity_hours_per_day, sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      const { data: membersRaw } = await supabase
        .from('resource_group_members')
        .select('id, group_id, profile_id, role');

      let profileMap = new Map<string, string>();
      if (membersRaw && membersRaw.length > 0) {
        const profileIds = [...new Set(membersRaw.map((m: any) => m.profile_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', profileIds);
        profileMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name || p.email]));
      }

      const builtGroups: ResourceGroup[] = (groupsRaw || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        type: g.type,
        is_active: g.is_active,
        capacity_hours_per_day: g.capacity_hours_per_day ?? 8,
        members: (membersRaw || [])
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => ({
            id: m.id,
            profile_id: m.profile_id,
            role: m.role,
            display_name: profileMap.get(m.profile_id) || 'Neznámý',
          })),
      }));

      const { data: plannedProjects } = await supabase
        .from('projects')
        .select('id, project_name, client_id, client_name, status, resource_group_id, montaz_start_date, montaz_end_date, deadline, address')
        .not('montaz_start_date', 'is', null)
        .neq('status', 'cancelled')
        .or(`montaz_start_date.lte.${lastDay},montaz_end_date.gte.${firstDay},deadline.gte.${firstDay}`)
        .order('montaz_start_date');

      const { data: unplanned } = await supabase
        .from('projects')
        .select('id, project_name, client_id, client_name, status, resource_group_id, montaz_start_date, montaz_end_date, deadline, address')
        .is('montaz_start_date', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50);

      const clientIds = [...new Set([
        ...(plannedProjects || []).map((p: any) => p.client_id),
        ...(unplanned || []).map((p: any) => p.client_id),
      ].filter(Boolean))];

      let clientMap = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
        clientMap = new Map((clients || []).map((c: any) => [c.id, c.name]));
      }

      const groupMemberMap = new Map<string, string[]>();
      builtGroups.forEach(g => {
        groupMemberMap.set(g.id, g.members.map(m => m.display_name));
      });

      const mapProject = (p: any): InstallationJob => ({
        id: p.id,
        project_id: p.id,
        project_name: p.project_name,
        client_name: p.client_id ? clientMap.get(p.client_id) || p.client_name : p.client_name,
        resource_group_id: p.resource_group_id,
        start_date: p.montaz_start_date,
        end_date: p.montaz_end_date || p.deadline,
        status: p.status,
        address: p.address,
        job_type: detectJobType(p),
        technicians: p.resource_group_id ? (groupMemberMap.get(p.resource_group_id) || []) : [],
      });

      setGroups(builtGroups);
      setJobs((plannedProjects || []).map(mapProject));
      setUnplannedJobs((unplanned || []).map(mapProject));
      setLoading(false);
    })();
  }, [weekDate, refreshKey]);

  return { groups, jobs, unplannedJobs, loading, refresh };
}
