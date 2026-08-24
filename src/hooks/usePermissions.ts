import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import type { ModuleKey, DataPermissionKey, RolePermissions, CustomRole } from '../lib/permissions';
import { createFullAccessPermissions, createNoAccessPermissions } from '../lib/permissions';

interface PermissionsState {
  loading: boolean;
  role: CustomRole | null;
  permissions: RolePermissions;
  hasModule: (key: ModuleKey) => boolean;
  hasPermission: (key: DataPermissionKey) => boolean;
  isFullAdmin: boolean;
  refresh: () => Promise<void>;
}

const FULL_ACCESS = createFullAccessPermissions();
const NO_ACCESS = createNoAccessPermissions();

export function usePermissions(): PermissionsState {
  const { user, isAdmin } = useAuth();
  const { organization, membership, loading: orgLoading } = useOrganization();
  const [rolesLoading, setRolesLoading] = useState(true);
  const [role, setRole] = useState<CustomRole | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions>(NO_ACCESS);

  const loading = rolesLoading || orgLoading;

  const isOwnerOrAdmin = membership?.role === 'owner' || membership?.role === 'admin';
  const isFullAdmin = isAdmin || isOwnerOrAdmin;

  const load = useCallback(async () => {
    if (!user || !organization) {
      setPermissions(NO_ACCESS);
      setRole(null);
      setRolesLoading(false);
      return;
    }

    if (isFullAdmin) {
      setPermissions(FULL_ACCESS);
      setRole(null);
      setRolesLoading(false);
      return;
    }

    const { data: assignment } = await supabase
      .from('user_role_assignments')
      .select('role_id')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!assignment?.role_id) {
      const fallbackPerms = createFullAccessPermissions();
      Object.keys(fallbackPerms.modules).forEach((k) => {
        fallbackPerms.modules[k as ModuleKey] = ['dashboard', 'projekty', 'ukoly', 'kalendar', 'znalosti', 'nastenka'].includes(k);
      });
      Object.keys(fallbackPerms.data).forEach((k) => {
        fallbackPerms.data[k as DataPermissionKey] = false;
      });
      setPermissions(fallbackPerms);
      setRole(null);
      setRolesLoading(false);
      return;
    }

    const { data: roleData } = await supabase
      .from('custom_roles')
      .select('*')
      .eq('id', assignment.role_id)
      .maybeSingle();

    if (roleData) {
      setRole(roleData as CustomRole);
      setPermissions(roleData.permissions as RolePermissions);
    } else {
      setRole(null);
      setPermissions(NO_ACCESS);
    }

    setRolesLoading(false);
  }, [user?.id, organization?.id, isFullAdmin]);

  useEffect(() => {
    setRolesLoading(true);
    load();
  }, [load]);

  const hasModule = useCallback(
    (key: ModuleKey) => {
      if (loading) return false;
      if (isFullAdmin) return true;
      return permissions.modules[key] === true;
    },
    [permissions, isFullAdmin, loading],
  );

  const hasPermission = useCallback(
    (key: DataPermissionKey) => {
      if (loading) return false;
      if (isFullAdmin) return true;
      return permissions.data[key] === true;
    },
    [permissions, isFullAdmin, loading],
  );

  return {
    loading,
    role,
    permissions,
    hasModule,
    hasPermission,
    isFullAdmin,
    refresh: load,
  };
}
