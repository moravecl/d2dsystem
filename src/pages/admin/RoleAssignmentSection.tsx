import { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2, ChevronDown, AlertTriangle, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import type { CustomRole } from '../../lib/permissions';

interface MemberWithRole {
  memberId: string;
  userId: string;
  displayName: string;
  email: string;
  orgRole: string;
  assignmentId: string | null;
  roleId: string | null;
  roleName: string | null;
  roleColor: string | null;
}

interface Props {
  roles: CustomRole[];
  onRefreshRoles: () => Promise<void>;
}

export default function RoleAssignmentSection({ roles }: Props) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [members, setMembers] = useState<MemberWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadMembers = useCallback(async () => {
    if (!organization) return;
    setLoading(true);

    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('id, user_id, role')
      .eq('organization_id', organization.id)
      .order('created_at');

    if (!orgMembers) { setLoading(false); return; }

    const userIds = orgMembers.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds);

    const { data: assignments } = await supabase
      .from('user_role_assignments')
      .select('id, user_id, role_id')
      .eq('organization_id', organization.id);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    const assignmentMap = Object.fromEntries((assignments || []).map((a) => [a.user_id, a]));
    const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));

    const result: MemberWithRole[] = orgMembers.map((m) => {
      const prof = profileMap[m.user_id];
      const assignment = assignmentMap[m.user_id];
      const role = assignment ? roleMap[assignment.role_id] : null;
      return {
        memberId: m.id,
        userId: m.user_id,
        displayName: prof?.display_name || '',
        email: prof?.email || '',
        orgRole: m.role,
        assignmentId: assignment?.id ?? null,
        roleId: assignment?.role_id ?? null,
        roleName: role?.name ?? null,
        roleColor: role?.color ?? null,
      };
    });

    setMembers(result);
    setLoading(false);
  }, [organization?.id, roles]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleRoleChange = async (member: MemberWithRole, newRoleId: string) => {
    if (!organization || !user) return;
    setChanging(member.userId);

    if (newRoleId === '') {
      if (member.assignmentId) {
        const { error } = await supabase
          .from('user_role_assignments')
          .delete()
          .eq('id', member.assignmentId);
        if (error) {
          toast('Chyba: ' + error.message, 'error');
        } else {
          toast('Role odebrana');
        }
      }
    } else if (member.assignmentId) {
      const { error } = await supabase
        .from('user_role_assignments')
        .update({ role_id: newRoleId })
        .eq('id', member.assignmentId);
      if (error) {
        toast('Chyba: ' + error.message, 'error');
      } else {
        toast('Role aktualizovana');
      }
    } else {
      const { error } = await supabase.from('user_role_assignments').insert({
        organization_id: organization.id,
        user_id: member.userId,
        role_id: newRoleId,
        assigned_by: user.id,
      });
      if (error) {
        toast('Chyba: ' + error.message, 'error');
      } else {
        toast('Role prirazena');
      }
    }

    await loadMembers();
    setChanging(null);
  };

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const ORG_ROLE_LABELS: Record<string, string> = {
    owner: 'Majitel', admin: 'Admin', manager: 'Manažer',
    employee: 'Zaměstnanec', viewer: 'Čtenář',
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-400 leading-relaxed">
          <strong>Jak to funguje:</strong> Každému členu týmu můžete přiřadit jednu roli z vašich vlastních rolí.
          Role určuje, ke kterým modulům a datům má uživatel přístup.
          Uživatele s organizační rolí Admin/Majitel mají vždy plný přístup bez ohledu na přiřazenou roli.
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-300">
            Členové týmu ({members.length})
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            {search ? 'Žádný člen neodpovídá hledání' : 'Žádní členové'}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredMembers.map((m) => {
              const isMe = m.userId === user?.id;
              const isAdminOrOwner = m.orgRole === 'owner' || m.orgRole === 'admin';
              return (
                <div key={m.userId} className={`flex items-center gap-4 px-5 py-3.5 ${isMe ? 'bg-blue-500/10/30' : 'hover:bg-white/[0.04]'} transition`}>
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
                    {(m.displayName || m.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {m.displayName || m.email}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded-full">Vy</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{m.email}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
                        {ORG_ROLE_LABELS[m.orgRole] || m.orgRole}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isAdminOrOwner ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-200 text-xs font-bold text-emerald-700">
                        <Shield className="w-3 h-3" />
                        Plný přístup
                      </div>
                    ) : changing === m.userId ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <div className="relative">
                        <select
                          value={m.roleId ?? ''}
                          onChange={(e) => handleRoleChange(m, e.target.value)}
                          className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs font-medium text-slate-400 focus:outline-none hover:border-white/[0.12] transition cursor-pointer min-w-[140px]"
                        >
                          <option value="">-- bez role --</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                    )}

                    {m.roleColor && !isAdminOrOwner && (
                      <div
                        className="w-3 h-3 rounded-full ring-2 ring-white shadow"
                        style={{ backgroundColor: m.roleColor }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
