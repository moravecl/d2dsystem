import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  subscription_tier: 'free' | 'pro' | 'business';
  max_users: number;
  is_active: boolean;
  logo_url: string | null;
  onboarding_tours_enabled?: boolean;
  workflow_enforcement?: 'guide' | 'confirm';
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'employee' | 'viewer';
  joined_at: string | null;
}

interface OrganizationState {
  organization: Organization | null;
  membership: OrganizationMember | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageTeam: boolean;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationState | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (retries = 4) => {
    if (!user) {
      setOrganization(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const memberResult = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberResult.error && attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      const orgId = memberResult.data?.organization_id ?? profile?.organization_id;

      if (!orgId) {
        setOrganization(null);
        setMembership(memberResult.data as OrganizationMember | null);
        setLoading(false);
        return;
      }

      const orgResult = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      if (orgResult.error && attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      setOrganization(orgResult.data as Organization | null);
      setMembership(memberResult.data as OrganizationMember | null);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [user?.id, profile?.organization_id]);

  const role = membership?.role ?? null;

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        membership,
        loading,
        isOwner: role === 'owner',
        isAdmin: role === 'owner' || role === 'admin',
        isManager: role === 'owner' || role === 'admin' || role === 'manager',
        canManageTeam: role === 'owner' || role === 'admin',
        refresh: load,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
  return ctx;
}
