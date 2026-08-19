import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

interface PlanUsage {
  userCount: number;
  projectCount: number;
  loading: boolean;
}

interface PlanLimits {
  canAddUser: boolean;
  canAddProject: boolean;
  userCount: number;
  projectCount: number;
  maxUsers: number;
  maxProjects: number;
  loading: boolean;
  refresh: () => void;
}

export function usePlanLimits(): PlanLimits {
  const { organization } = useOrganization();
  const [usage, setUsage] = useState<PlanUsage>({ userCount: 0, projectCount: 0, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!organization) {
      setUsage({ userCount: 0, projectCount: 0, loading: false });
      return;
    }

    let cancelled = false;

    const load = async () => {
      const [membersRes, projectsRes] = await Promise.all([
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id),
        supabase
          .from('projects')
          .select('id', { count: 'exact', head: true }),
      ]);

      if (!cancelled) {
        setUsage({
          userCount: membersRes.count ?? 0,
          projectCount: projectsRes.count ?? 0,
          loading: false,
        });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [organization?.id, tick]);

  const maxUsers = organization?.max_users ?? 5;
  const maxProjects = getMaxProjects(organization?.subscription_tier ?? 'free');

  return {
    canAddUser: usage.userCount < maxUsers,
    canAddProject: usage.projectCount < maxProjects,
    userCount: usage.userCount,
    projectCount: usage.projectCount,
    maxUsers,
    maxProjects,
    loading: usage.loading,
    refresh: () => setTick(t => t + 1),
  };
}

function getMaxProjects(tier: string): number {
  switch (tier) {
    case 'free': return 10;
    case 'pro': return 9999;
    case 'business': return 9999;
    case 'enterprise': return 9999;
    default: return 10;
  }
}
