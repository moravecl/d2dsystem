import { useEffect, useState, useCallback } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { Users, ShieldCheck, ShieldOff, Eye, ChevronDown, ChevronUp, KeyRound, CreditCard as Edit, UserPlus, Trash2, Loader2, RefreshCw, Mail, Crown, Shield, Wrench, User, AlertTriangle, Plus, Copy, Lock, EyeOff, Save, X, Check, ChevronRight, Search, Phone, MapPin, Cake, Briefcase, Clock, Palmtree, Calendar, FileText, Download, Send, CheckCircle, Archive, PenTool } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { sendTeamInviteEmail } from '../../lib/transactionalEmail';
import { loadQuoteCompanyInfo, type QuoteCompanyInfo } from '../../lib/quoteHeaderHtml';
import Modal from '../../components/ui/Modal';
import type { Profile, Project } from '../../types/database';
import type { CustomRole, RolePermissions, ModuleKey, DataPermissionKey } from '../../lib/permissions';
import {
  MODULE_KEYS, MODULE_LABELS,
  DATA_PERMISSION_GROUPS, DATA_PERMISSION_LABELS,
  getDefaultPermissions,
} from '../../lib/permissions';

type Tab = 'users' | 'team' | 'roles';
type OrgRole = 'owner' | 'admin' | 'manager' | 'employee' | 'viewer';

const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Majitel',
  admin: 'Admin',
  manager: 'Manažer',
  employee: 'Zaměstnanec',
  viewer: 'Čtenář',
};

const ORG_ROLE_ICONS: Record<OrgRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  manager: Wrench,
  employee: User,
  viewer: Eye,
};

const ORG_ROLE_COLORS: Record<OrgRole, string> = {
  owner: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  admin: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  manager: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  employee: 'bg-white/[0.06] text-slate-400 border-white/10',
  viewer: 'bg-white/[0.06] text-slate-500 border-white/10',
};

interface UserWithProjects extends Profile {
  projects: Project[];
}

interface TeamMember {
  id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string | null;
  invited_at: string | null;
  profile: {
    display_name: string;
    email: string;
    is_portal_client: boolean;
    phone?: string;
    address?: string;
    birth_date?: string;
    job_position?: string;
    vacation_days_per_year?: number;
    monthly_work_hours_fund?: number;
    is_employee?: boolean;
  } | null;
}

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

const PRESET_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#64748b',
];

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('users');
  const { user: currentUser, profile: currentProfile, isAdmin } = useAuth();
  const { organization, canManageTeam } = useOrganization();
  const { toast } = useToast();
  const planLimits = usePlanLimits();

  const [users, setUsers] = useState<UserWithProjects[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editIsEmployee, setEditIsEmployee] = useState(false);
  const [editRole, setEditRole] = useState<string>('user');
  const [saving, setSaving] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('employee');
  const [inviting, setInviting] = useState(false);
  const [changingOrgRole, setChangingOrgRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<CustomRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<string | null>(null);
  const [roleTab, setRoleTab] = useState<'roles' | 'assignments'>('roles');

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createRole, setCreateRole] = useState<OrgRole>('employee');
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    const mapped: UserWithProjects[] = (profiles ?? []).map((p) => ({
      ...p,
      projects: (projects ?? []).filter((pr) => pr.user_id === p.id),
    }));
    setUsers(mapped);
  }, []);

  const loadTeamMembers = useCallback(async () => {
    if (!organization) return;
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at, invited_at')
      .eq('organization_id', organization.id)
      .order('created_at');

    if (!orgMembers) return;

    const userIds = orgMembers.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_portal_client, phone, address, birth_date, job_position, vacation_days_per_year, monthly_work_hours_fund, is_employee')
      .in('id', userIds);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    setTeamMembers(
      orgMembers.map((m) => ({
        ...m,
        role: m.role as OrgRole,
        profile: profileMap[m.user_id] ?? null,
      }))
    );
  }, [organization?.id]);

  const loadRoles = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from('custom_roles')
      .select('*')
      .eq('organization_id', organization.id)
      .order('sort_order');
    setRoles((data ?? []) as CustomRole[]);
    if (!selectedRoleId && data && data.length > 0) {
      setSelectedRoleId(data[0].id);
    }
  }, [organization?.id, selectedRoleId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadTeamMembers(), loadRoles()]);
    setLoading(false);
  }, [loadUsers, loadTeamMembers, loadRoles]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    if (userId === currentUser?.id) {
      toast('Nemůžeš změnit svou vlastní roli', 'error');
      return;
    }
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast(newRole === 'admin' ? 'Uživatel povýšen na admina' : 'Admin role odebrána');
    loadUsers();
  };

  const handleChangePassword = async () => {
    if (!passwordUserId || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      toast('Heslo musí mít alespoň 6 znaků', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Nejste přihlášeni', 'error');
        return;
      }
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: passwordUserId, newPassword }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error || 'Chyba při změně hesla', 'error');
      } else {
        toast('Heslo bylo změněno');
        setPasswordUserId(null);
        setNewPassword('');
      }
    } catch {
      toast('Chyba při změně hesla', 'error');
    }
    setChangingPassword(false);
  };

  const openEditModal = (user: Profile) => {
    setEditUserId(user.id);
    setEditDisplayName(user.display_name || '');
    setEditIsEmployee(user.is_employee || false);
    setEditRole(user.role || 'user');
  };

  const handleSaveEdit = async () => {
    if (!editUserId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: editDisplayName.trim() || null,
        is_employee: editIsEmployee,
        role: editRole,
      })
      .eq('id', editUserId);
    setSaving(false);
    if (error) {
      toast('Chyba při ukládání', 'error');
      return;
    }
    toast('Uživatel aktualizován');
    setEditUserId(null);
    loadUsers();
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !organization) return;

    if (!planLimits.canAddUser) {
      toast(`Dosáhli jste limitu ${planLimits.maxUsers} uživatelů.`, 'error');
      return;
    }

    setInviting(true);
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, organization_id, is_portal_client')
      .eq('email', inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (!existingProfile) {
      toast('Uživatel s tímto emailem neexistuje. Nejprve musí vytvořit účet nebo ho vytvořte níže.', 'error');
      setInviting(false);
      return;
    }

    if (existingProfile.is_portal_client) {
      toast('Tento účet je klientský portálový účet.', 'error');
      setInviting(false);
      return;
    }

    if (existingProfile.organization_id && existingProfile.organization_id !== organization.id) {
      toast('Uživatel je již členem jiné organizace.', 'error');
      setInviting(false);
      return;
    }

    const alreadyMember = teamMembers.some((m) => m.user_id === existingProfile.id);
    if (alreadyMember) {
      toast('Uživatel je již členem této organizace.', 'error');
      setInviting(false);
      return;
    }

    const { error: memberError } = await supabase.from('organization_members').insert({
      organization_id: organization.id,
      user_id: existingProfile.id,
      role: inviteRole,
      invited_by: currentUser?.id,
      invited_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      toast('Chyba při přidávání člena: ' + memberError.message, 'error');
      setInviting(false);
      return;
    }

    await supabase
      .from('profiles')
      .update({ organization_id: organization.id })
      .eq('id', existingProfile.id);

    toast(`${inviteEmail} byl přidán do týmu.`);
    setInviteEmail('');

    sendTeamInviteEmail({
      organizationId: organization.id,
      organizationName: organization.name,
      inviterName: currentUser?.email ?? 'Administrátor',
      recipientEmail: inviteEmail.trim(),
      role: inviteRole,
    }).catch(() => {});

    await loadTeamMembers();
    setInviting(false);
  };

  const handleOrgRoleChange = async (member: TeamMember, newRole: OrgRole) => {
    if (member.user_id === currentUser?.id) {
      toast('Nemůžete změnit vlastní roli.', 'error');
      return;
    }
    setChangingOrgRole(member.id);
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', member.id);

    if (error) {
      toast('Chyba: ' + error.message, 'error');
    } else {
      toast('Role aktualizována.');
      await loadTeamMembers();
    }
    setChangingOrgRole(null);
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === currentUser?.id) {
      toast('Nemůžete odebrat sebe z organizace.', 'error');
      return;
    }
    if (!confirm('Opravdu odebrat tohoto člena?')) return;
    setRemovingMember(memberId);

    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) {
      toast('Chyba: ' + error.message, 'error');
    } else {
      await supabase.from('profiles').update({ organization_id: null }).eq('id', userId);
      toast('Člen odebrán.');
      await loadTeamMembers();
    }
    setRemovingMember(null);
  };

  const handleDeleteRole = async (role: CustomRole) => {
    if (role.is_system) {
      toast('Systémové role nelze smazat', 'error');
      return;
    }
    if (!confirm(`Opravdu smazat roli "${role.name}"?`)) return;
    setDeletingRole(role.id);
    const { error } = await supabase.from('custom_roles').delete().eq('id', role.id);
    if (error) {
      toast('Chyba: ' + error.message, 'error');
    } else {
      toast('Role smazána');
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      await loadRoles();
    }
    setDeletingRole(null);
  };

  const handleCreateUser = async () => {
    if (!createEmail.trim() || !createPassword.trim()) {
      toast('Vyplňte email a heslo', 'error');
      return;
    }
    if (createPassword.length < 6) {
      toast('Heslo musí mít alespoň 6 znaků', 'error');
      return;
    }
    if (!organization) {
      toast('Organizace není načtena', 'error');
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Nejste přihlášeni', 'error');
        setCreating(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-user`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: createEmail.trim().toLowerCase(),
          password: createPassword,
          displayName: createDisplayName.trim() || null,
          isPortalClient: false,
          organizationId: organization.id,
          orgRole: createRole,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast(result.error || 'Chyba při vytváření uživatele', 'error');
      } else {
        toast('Uživatel vytvořen a přidán do týmu');
        setShowCreateUserModal(false);
        setCreateEmail('');
        setCreatePassword('');
        setCreateDisplayName('');
        setCreateRole('employee');
        await loadAll();
      }
    } catch {
      toast('Chyba při vytváření uživatele', 'error');
    }
    setCreating(false);
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          Správa uživatelů a týmu
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Spravujte uživatele, členy týmu, role a oprávnění na jednom místě.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 bg-white/[0.04] p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
            tab === 'users' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Uživatelé
        </button>
        <button
          onClick={() => setTab('team')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
            tab === 'team' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Crown className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Tým
        </button>
        <button
          onClick={() => setTab('roles')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
            tab === 'roles' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Role a oprávnění
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : tab === 'users' ? (
        <UsersTab
          users={users}
          currentUser={currentUser}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          passwordUserId={passwordUserId}
          setPasswordUserId={setPasswordUserId}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          changingPassword={changingPassword}
          handleChangePassword={handleChangePassword}
          openEditModal={openEditModal}
          toggleAdminRole={toggleAdminRole}
          onRefresh={loadUsers}
          onCreateUser={() => setShowCreateUserModal(true)}
        />
      ) : tab === 'team' ? (
        <TeamTab
          organization={organization}
          members={teamMembers}
          currentUser={currentUser}
          canManageTeam={canManageTeam}
          planLimits={planLimits}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviting={inviting}
          handleInvite={handleInvite}
          changingOrgRole={changingOrgRole}
          handleOrgRoleChange={handleOrgRoleChange}
          removingMember={removingMember}
          handleRemoveMember={handleRemoveMember}
          onRefresh={loadTeamMembers}
          onCreateUser={() => setShowCreateUserModal(true)}
        />
      ) : (
        <RolesTab
          organization={organization}
          roles={roles}
          selectedRoleId={selectedRoleId}
          setSelectedRoleId={setSelectedRoleId}
          selectedRole={selectedRole}
          roleTab={roleTab}
          setRoleTab={setRoleTab}
          onNewRole={() => { setDuplicateSource(null); setShowNewRoleModal(true); }}
          onEditRole={setEditingRole}
          onDuplicateRole={(r) => { setDuplicateSource(r); setShowNewRoleModal(true); }}
          onDeleteRole={handleDeleteRole}
          deletingRole={deletingRole}
          onRefresh={loadRoles}
          currentUser={currentUser}
          toast={toast}
        />
      )}

      <Modal
        open={!!editUserId}
        onClose={() => setEditUserId(null)}
        title="Upravit uživatele"
        size="sm"
        footer={
          <>
            <button onClick={() => setEditUserId(null)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-lg transition">
              Zrušit
            </button>
            <button onClick={handleSaveEdit} disabled={saving} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50">
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Zobrazované jméno</label>
            <input
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
              placeholder="Jan Novák"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Role</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              disabled={editUserId === currentUser?.id}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 disabled:opacity-50"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manažer</option>
              <option value="employee">Zaměstnanec</option>
              <option value="user">Uživatel</option>
            </select>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={editIsEmployee} onChange={(e) => setEditIsEmployee(e.target.checked)} className="rounded border-white/10" />
            <div>
              <span className="text-sm font-semibold text-slate-300">Zaměstnanec</span>
              <p className="text-xs text-slate-500">Může být přiřazen k pracovním záznamům</p>
            </div>
          </label>
        </div>
      </Modal>

      <Modal
        open={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        title="Vytvořit nového uživatele"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowCreateUserModal(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-lg transition">
              Zrušit
            </button>
            <button onClick={handleCreateUser} disabled={creating || !createEmail.trim() || !createPassword.trim()} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Vytvořit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email *</label>
            <input
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
              placeholder="email@example.cz"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Heslo *</label>
            <input
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
              placeholder="Min. 6 znaků"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Zobrazované jméno</label>
            <input
              value={createDisplayName}
              onChange={(e) => setCreateDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
              placeholder="Jan Novák"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Role v týmu</label>
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as OrgRole)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manažer</option>
              <option value="employee">Zaměstnanec</option>
              <option value="viewer">Čtenář</option>
            </select>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-xs text-blue-400">
            Uživatel bude automaticky přidán do vaší organizace.
          </div>
        </div>
      </Modal>

      {(showNewRoleModal || editingRole) && (
        <RoleFormModal
          role={editingRole}
          duplicateFrom={duplicateSource}
          organizationId={organization?.id ?? ''}
          onClose={() => { setShowNewRoleModal(false); setEditingRole(null); setDuplicateSource(null); }}
          onSaved={async () => {
            setShowNewRoleModal(false);
            setEditingRole(null);
            setDuplicateSource(null);
            await loadRoles();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

function UsersTab({
  users, currentUser, expandedId, setExpandedId, passwordUserId, setPasswordUserId,
  newPassword, setNewPassword, changingPassword, handleChangePassword, openEditModal,
  toggleAdminRole, onRefresh, onCreateUser,
}: {
  users: UserWithProjects[];
  currentUser: { id: string } | null;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  passwordUserId: string | null;
  setPasswordUserId: (id: string | null) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  changingPassword: boolean;
  handleChangePassword: () => void;
  openEditModal: (user: Profile) => void;
  toggleAdminRole: (userId: string, currentRole: string) => void;
  onRefresh: () => void;
  onCreateUser: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-400">Všichni uživatelé ({users.length})</span>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onCreateUser} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition">
            <UserPlus className="w-4 h-4" />
            Nový uživatel
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-navy-800/60 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-10 text-center">
          <div className="text-lg font-extrabold text-white">Zatím žádní uživatelé</div>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isExpanded = expandedId === u.id;
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${u.role === 'admin' ? 'bg-teal-500/15 text-teal-300' : 'bg-white/[0.06] text-slate-400'}`}>
                      {u.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-white truncate">
                        {u.display_name || u.email}
                        {isSelf && <span className="ml-2 text-xs font-extrabold text-blue-400">(vy)</span>}
                      </div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                          u.role === 'admin' ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25' :
                          u.role === 'manager' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25' :
                          u.role === 'employee' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25' :
                          'bg-white/[0.06] text-slate-400 border border-white/[0.06]'
                        }`}>
                          {u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Manažer' : u.role === 'employee' ? 'Zaměstnanec' : 'Uživatel'}
                        </span>
                        {u.is_employee && (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            Evidován v docházce
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          Registrace: {new Date(u.created_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button onClick={() => openEditModal(u)} className="px-3 py-2 rounded-xl bg-blue-500/10 text-blue-300 text-xs font-extrabold hover:bg-blue-500/20 transition flex items-center gap-1.5">
                      <Edit className="w-3.5 h-3.5" /> Upravit
                    </button>
                    {u.projects.length > 0 && (
                      <button onClick={() => setExpandedId(isExpanded ? null : u.id)} className="px-3 py-2 rounded-xl bg-white/[0.06] text-slate-300 text-xs font-extrabold hover:bg-white/[0.10] transition flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        Konfigurace
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                    {!isSelf && (
                      <button onClick={() => { setPasswordUserId(passwordUserId === u.id ? null : u.id); setNewPassword(''); }} className="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-extrabold hover:bg-amber-500/25 transition flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" /> Heslo
                      </button>
                    )}
                    {!isSelf && (
                      <button onClick={() => toggleAdminRole(u.id, u.role)} className={`px-3 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${u.role === 'admin' ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-teal-500/15 text-teal-300 hover:bg-teal-500/25'}`}>
                        {u.role === 'admin' ? <><ShieldOff className="w-3.5 h-3.5" /> Odebrat admina</> : <><ShieldCheck className="w-3.5 h-3.5" /> Admin</>}
                      </button>
                    )}
                  </div>
                </div>

                {passwordUserId === u.id && (
                  <div className="border-t border-white/[0.08] bg-amber-500/[0.07] p-4">
                    <div className="flex items-center gap-3 max-w-md">
                      <input type="password" autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }} placeholder="Nové heslo (min. 6 znaků)..." className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50" />
                      <button onClick={handleChangePassword} disabled={changingPassword || newPassword.length < 6} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-extrabold hover:bg-amber-500 transition disabled:opacity-50">
                        {changingPassword ? 'Měním...' : 'Uložit'}
                      </button>
                      <button onClick={() => { setPasswordUserId(null); setNewPassword(''); }} className="px-3 py-2 rounded-xl text-slate-400 hover:bg-white/[0.06] text-xs font-extrabold transition">
                        Zrušit
                      </button>
                    </div>
                  </div>
                )}

                {isExpanded && u.projects.length > 0 && (
                  <div className="border-t border-white/[0.08] bg-navy-900/50 p-5">
                    <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-3">
                      Uložené konfigurace ({u.projects.length})
                    </div>
                    <div className="space-y-2">
                      {u.projects.map((proj) => (
                        <div key={proj.id} className="bg-navy-800/60 rounded-xl border border-white/[0.08] p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-white truncate">{proj.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Projekt: <b>{proj.project_name || '—'}</b> | Zákazník: <b>{proj.client_name || '—'}</b>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 shrink-0">
                            {new Date(proj.created_at).toLocaleDateString('cs-CZ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface EmployeeContract {
  id: string;
  employee_id: string;
  template_id: string | null;
  title: string;
  content: string;
  generated_at: string;
  signed_at: string | null;
  signature_employee: string | null;
  signature_employer: string | null;
  status: 'draft' | 'sent' | 'signed' | 'archived';
  organization_id: string;
  created_at: string;
}

interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  template_type: string;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Koncept', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: FileText },
  sent: { label: 'Odesláno', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Send },
  signed: { label: 'Podepsáno', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  archived: { label: 'Archivováno', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Archive },
};

function TeamTab({
  organization, members, currentUser, canManageTeam, planLimits,
  inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviting, handleInvite,
  changingOrgRole, handleOrgRoleChange, removingMember, handleRemoveMember, onRefresh, onCreateUser,
}: {
  organization: { id: string; name: string; subscription_tier: string } | null;
  members: TeamMember[];
  currentUser: { id: string } | null;
  canManageTeam: boolean;
  planLimits: { canAddUser: boolean; maxUsers: number; userCount: number; loading: boolean };
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: OrgRole;
  setInviteRole: (v: OrgRole) => void;
  inviting: boolean;
  handleInvite: () => void;
  changingOrgRole: string | null;
  handleOrgRoleChange: (member: TeamMember, newRole: OrgRole) => void;
  removingMember: string | null;
  handleRemoveMember: (memberId: string, userId: string) => void;
  onRefresh: () => void;
  onCreateUser: () => void;
}) {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ phone: '', address: '', birth_date: '', job_position: '', vacation_days_per_year: 20, monthly_work_hours_fund: 160 });
  const [savingProfile, setSavingProfile] = useState(false);
  const { toast } = useToast();

  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [showContractModal, setShowContractModal] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [contractTitle, setContractTitle] = useState('');
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractDataStep, setContractDataStep] = useState(false);
  const [contractData, setContractData] = useState({
    work_location: '',
    start_date: '',
    contract_duration: 'neurcitou',
    weekly_hours: '40',
    salary: '',
  });
  const [viewingContract, setViewingContract] = useState<EmployeeContract | null>(null);
  const [companyInfo, setCompanyInfo] = useState<QuoteCompanyInfo | null>(null);
  const [updatingContractStatus, setUpdatingContractStatus] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      loadContracts();
      loadContractTemplates();
      loadQuoteCompanyInfo().then(setCompanyInfo);
    }
  }, [organization?.id]);

  const loadContracts = async () => {
    if (!organization) return;
    setLoadingContracts(true);
    const { data } = await supabase
      .from('employee_contracts')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false });
    setContracts((data ?? []) as EmployeeContract[]);
    setLoadingContracts(false);
  };

  const loadContractTemplates = async () => {
    const { data } = await supabase
      .from('document_templates')
      .select('id, name, content, template_type')
      .eq('template_type', 'contract')
      .eq('is_active', true)
      .order('name');
    setContractTemplates((data ?? []) as ContractTemplate[]);
  };

  const handleGenerateContract = async (employeeId: string) => {
    if (!organization || !contractTitle.trim()) {
      toast('Vyplnte nazev smlouvy', 'error');
      return;
    }
    setGeneratingContract(true);

    const member = members.find(m => m.user_id === employeeId);
    const profile = member?.profile;
    const employeeName = profile?.display_name || profile?.email || '';

    let content = '';
    if (selectedTemplateId) {
      const tpl = contractTemplates.find(t => t.id === selectedTemplateId);
      if (tpl) {
        content = tpl.content
          .replace(/\{\{employee_name\}\}/g, employeeName)
          .replace(/\{\{employee_birth_date\}\}/g, profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString('cs-CZ') : '')
          .replace(/\{\{employee_address\}\}/g, profile?.address || '')
          .replace(/\{\{job_position\}\}/g, profile?.job_position || '')
          .replace(/\{\{vacation_days\}\}/g, String(profile?.vacation_days_per_year || 20))
          .replace(/\{\{company_name\}\}/g, companyInfo?.company_name || organization.name || '')
          .replace(/\{\{company_ico\}\}/g, companyInfo?.company_id || '')
          .replace(/\{\{company_address\}\}/g, [companyInfo?.address, [companyInfo?.zip, companyInfo?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))
          .replace(/\{\{work_location\}\}/g, contractData.work_location)
          .replace(/\{\{start_date\}\}/g, contractData.start_date ? new Date(contractData.start_date).toLocaleDateString('cs-CZ') : '')
          .replace(/\{\{contract_duration\}\}/g, contractData.contract_duration)
          .replace(/\{\{weekly_hours\}\}/g, contractData.weekly_hours)
          .replace(/\{\{salary\}\}/g, contractData.salary)
          .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('cs-CZ'));
      }
    }

    const { error } = await supabase.from('employee_contracts').insert({
      employee_id: employeeId,
      template_id: selectedTemplateId || null,
      title: contractTitle.trim(),
      content: content || `Pracovni smlouva pro ${employeeName}`,
      status: 'draft',
      organization_id: organization.id,
    });

    setGeneratingContract(false);
    if (error) {
      toast('Chyba pri generovani smlouvy', 'error');
      return;
    }
    toast('Smlouva vygenerovana');
    setShowContractModal(null);
    setContractTitle('');
    setSelectedTemplateId('');
    setContractDataStep(false);
    setContractData({ work_location: '', start_date: '', contract_duration: 'neurcitou', weekly_hours: '40', salary: '' });
    loadContracts();
  };

  const handleUpdateContractStatus = async (contractId: string, newStatus: string) => {
    setUpdatingContractStatus(contractId);
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'signed') {
      updates.signed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('employee_contracts')
      .update(updates)
      .eq('id', contractId);
    setUpdatingContractStatus(null);
    if (error) {
      toast('Chyba pri aktualizaci', 'error');
      return;
    }
    toast('Stav smlouvy aktualizovan');
    loadContracts();
    if (viewingContract?.id === contractId) {
      setViewingContract({ ...viewingContract, status: newStatus as EmployeeContract['status'] });
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Opravdu smazat tuto smlouvu?')) return;
    const { error } = await supabase.from('employee_contracts').delete().eq('id', contractId);
    if (error) {
      toast('Chyba pri mazani', 'error');
      return;
    }
    toast('Smlouva smazana');
    loadContracts();
    if (viewingContract?.id === contractId) {
      setViewingContract(null);
    }
  };

  const getEmployeeContracts = (employeeId: string) => {
    return contracts.filter(c => c.employee_id === employeeId);
  };

  if (!organization) {
    return <div className="text-center py-12 text-slate-500">Organizace nenalezena.</div>;
  }

  const openEditProfile = (m: TeamMember) => {
    setEditingMemberId(m.user_id);
    setEditForm({
      phone: m.profile?.phone || '',
      address: m.profile?.address || '',
      birth_date: m.profile?.birth_date || '',
      job_position: m.profile?.job_position || '',
      vacation_days_per_year: m.profile?.vacation_days_per_year || 20,
      monthly_work_hours_fund: m.profile?.monthly_work_hours_fund || 160,
    });
  };

  const handleSaveProfile = async () => {
    if (!editingMemberId) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        phone: editForm.phone || null,
        address: editForm.address || null,
        birth_date: editForm.birth_date || null,
        job_position: editForm.job_position || null,
        vacation_days_per_year: editForm.vacation_days_per_year,
        monthly_work_hours_fund: editForm.monthly_work_hours_fund,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingMemberId);
    setSavingProfile(false);
    if (error) {
      toast('Chyba pri ukladani', 'error');
      return;
    }
    toast('Profil aktualizovan');
    setEditingMemberId(null);
    onRefresh();
  };

  const formatBirthDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
  };

  const isUpcomingBirthday = (dateStr?: string) => {
    if (!dateStr) return false;
    const today = new Date();
    const birth = new Date(dateStr);
    const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    const diff = thisYearBirthday.getTime() - today.getTime();
    return diff >= 0 && diff <= 14 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            Organizace: <strong className="text-slate-300">{organization.name}</strong>
          </p>
          {!planLimits.loading && (
            <div className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${planLimits.canAddUser ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {!planLimits.canAddUser && <AlertTriangle className="w-3 h-3" />}
              <Users className="w-3 h-3" />
              {planLimits.userCount} / {planLimits.maxUsers >= 999 ? '\u221E' : planLimits.maxUsers} uzivatelu
            </div>
          )}
        </div>
        <button onClick={onRefresh} className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {canManageTeam && (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-5">
          <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-400" />
            Pridat clena
          </h2>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="email@uzivatele.cz"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-sm font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
            >
              {(['admin', 'manager', 'employee', 'viewer'] as OrgRole[]).map((r) => (
                <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition disabled:opacity-40 flex items-center gap-2 shrink-0"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Pridat
            </button>
            <button
              onClick={onCreateUser}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Vytvořit nového
            </button>
          </div>
          {!planLimits.canAddUser && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Dosáhli jste limitu uživatelů ({planLimits.maxUsers}).
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Přidejte existujícího uživatele nebo vytvořte nový účet.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-400">Clenove tymu ({members.length})</span>
      </div>

      {members.length === 0 ? (
        <div className="bg-navy-800/60 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-10 text-center">
          <div className="text-lg font-extrabold text-white">Zatim zadni clenove</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map((m) => {
            const RoleIcon = ORG_ROLE_ICONS[m.role];
            const isMe = m.user_id === currentUser?.id;
            const upcomingBday = isUpcomingBirthday(m.profile?.birth_date);
            return (
              <div key={m.id} className={`bg-navy-800/60 backdrop-blur-sm rounded-2xl border overflow-hidden transition hover:border-white/15 ${isMe ? 'border-blue-500/30 ring-1 ring-blue-500/20' : 'border-white/[0.08]'}`}>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg">
                      {(m.profile?.display_name || m.profile?.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-white truncate">
                          {m.profile?.display_name || m.profile?.email || m.user_id}
                        </h3>
                        {isMe && <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full">Vy</span>}
                        {upcomingBday && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Cake className="w-2.5 h-2.5" />Narozeniny</span>}
                      </div>
                      {m.profile?.job_position && (
                        <div className="text-xs text-slate-400 mt-0.5">{m.profile.job_position}</div>
                      )}
                      <div className="text-xs text-slate-500 truncate">{m.profile?.email}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {m.profile?.phone && (
                      <div className="flex items-center gap-2.5 text-xs text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{m.profile.phone}</span>
                      </div>
                    )}
                    {m.profile?.address && (
                      <div className="flex items-center gap-2.5 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{m.profile.address}</span>
                      </div>
                    )}
                    {m.profile?.birth_date && (
                      <div className="flex items-center gap-2.5 text-xs text-slate-400">
                        <Cake className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatBirthDate(m.profile.birth_date)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${ORG_ROLE_COLORS[m.role]}`}>
                      <RoleIcon className="w-3 h-3" />
                      {ORG_ROLE_LABELS[m.role]}
                    </div>
                    {m.profile?.is_employee && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Briefcase className="w-3 h-3" />
                        Zaměstnanec
                      </div>
                    )}
                  </div>

                  {m.profile?.is_employee && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="bg-white/[0.04] rounded-xl p-3">
                        <div className="flex items-center gap-2 text-slate-500 mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Měsíční fond</span>
                        </div>
                        <div className="text-lg font-extrabold text-white">{m.profile.monthly_work_hours_fund || 160}h</div>
                      </div>
                      <div className="bg-white/[0.04] rounded-xl p-3">
                        <div className="flex items-center gap-2 text-slate-500 mb-1">
                          <Palmtree className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Dovolena</span>
                        </div>
                        <div className="text-lg font-extrabold text-white">{m.profile.vacation_days_per_year || 20} dni</div>
                      </div>
                    </div>
                  )}

                  {m.profile?.is_employee && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <FileText className="w-3 h-3" />
                          Smlouvy ({getEmployeeContracts(m.user_id).length})
                        </span>
                        {canManageTeam && (
                          <button
                            onClick={() => setShowContractModal(m.user_id)}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Nova
                          </button>
                        )}
                      </div>
                      {getEmployeeContracts(m.user_id).length > 0 ? (
                        <div className="space-y-1.5">
                          {getEmployeeContracts(m.user_id).slice(0, 3).map(contract => {
                            const statusCfg = CONTRACT_STATUS_CONFIG[contract.status] || CONTRACT_STATUS_CONFIG.draft;
                            const StatusIcon = statusCfg.icon;
                            return (
                              <button
                                key={contract.id}
                                onClick={() => setViewingContract(contract)}
                                className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition text-left"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="text-xs text-slate-300 truncate flex-1">{contract.title}</span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusCfg.color}`}>
                                  <StatusIcon className="w-2.5 h-2.5" />
                                  {statusCfg.label}
                                </span>
                              </button>
                            );
                          })}
                          {getEmployeeContracts(m.user_id).length > 3 && (
                            <div className="text-[10px] text-slate-500 text-center pt-1">
                              +{getEmployeeContracts(m.user_id).length - 3} dalsich
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic">Zadne smlouvy</div>
                      )}
                    </div>
                  )}
                </div>

                {canManageTeam && (
                  <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!isMe && m.role !== 'owner' && (
                        changingOrgRole === m.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : (
                          <select
                            value={m.role}
                            onChange={(e) => handleOrgRoleChange(m, e.target.value as OrgRole)}
                            className="appearance-none pl-2 pr-6 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs font-medium text-slate-400 focus:outline-none hover:border-white/20 transition cursor-pointer"
                          >
                            {(['admin', 'manager', 'employee', 'viewer'] as OrgRole[]).map((r) => (
                              <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditProfile(m)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.06] transition flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Upravit
                      </button>
                      {!isMe && m.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.user_id)}
                          disabled={!!removingMember}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          {removingMember === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-300 leading-relaxed">
          <strong>Organizační role</strong> určuje základní úroveň přístupu (Majitel a Admin mají vždy plný přístup).
          Pro detailní nastavení oprávnění přejděte na záložku <strong>Role a oprávnění</strong>.
        </div>
      </div>

      <Modal
        open={!!editingMemberId}
        onClose={() => setEditingMemberId(null)}
        title="Upravit profil člena"
        size="md"
        footer={
          <>
            <button onClick={() => setEditingMemberId(null)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-lg transition">
              Zrušit
            </button>
            <button onClick={handleSaveProfile} disabled={savingProfile} className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
              Uložit
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Telefon</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="+420 123 456 789"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Pozice</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={editForm.job_position}
                  onChange={(e) => setEditForm({ ...editForm, job_position: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Projektant, Technik..."
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Adresa</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Ulice 123, Mesto"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum narozeni</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={editForm.birth_date}
                onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <h4 className="text-xs font-bold text-slate-300 mb-3">Nastavení pracovního poměru</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Měsíční fond hodin</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    value={editForm.monthly_work_hours_fund}
                    onChange={(e) => setEditForm({ ...editForm, monthly_work_hours_fund: parseInt(e.target.value) || 0 })}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    min={0}
                    max={250}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Standardne 160h (plny uvazek)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Dnu dovolene / rok</label>
                <div className="relative">
                  <Palmtree className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    value={editForm.vacation_days_per_year}
                    onChange={(e) => setEditForm({ ...editForm, vacation_days_per_year: parseInt(e.target.value) || 0 })}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    min={0}
                    max={60}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Standardne 20 dnu</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!showContractModal}
        onClose={() => { setShowContractModal(null); setContractTitle(''); setSelectedTemplateId(''); setContractDataStep(false); setContractData({ work_location: '', start_date: '', contract_duration: 'neurcitou', weekly_hours: '40', salary: '' }); }}
        title={contractDataStep ? 'Doplnit udaje smlouvy' : 'Vygenerovat smlouvu'}
        size="md"
        footer={
          <>
            {contractDataStep ? (
              <>
                <button onClick={() => setContractDataStep(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-lg transition">
                  Zpet
                </button>
                <button
                  onClick={() => handleGenerateContract(showContractModal!)}
                  disabled={generatingContract}
                  className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingContract && <Loader2 className="w-4 h-4 animate-spin" />}
                  Vygenerovat
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setShowContractModal(null); setContractTitle(''); setSelectedTemplateId(''); }} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-lg transition">
                  Zrušit
                </button>
                <button
                  onClick={() => setContractDataStep(true)}
                  disabled={!contractTitle.trim()}
                  className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  Pokracovat
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </>
        }
      >
        {contractDataStep ? (
          <div className="space-y-4">
            <div className="p-3 bg-white/[0.04] rounded-xl border border-white/10 mb-4">
              <p className="text-xs text-slate-400">Doplnte udaje, ktere nejsou v profilu zamestnance. Tyto udaje se pouziji pro nahrazeni placeholderu v sablone.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Misto vykonu prace</label>
                <input
                  value={contractData.work_location}
                  onChange={(e) => setContractData({ ...contractData, work_location: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Praha"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Datum nastupu</label>
                <input
                  type="date"
                  value={contractData.start_date}
                  onChange={(e) => setContractData({ ...contractData, start_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Doba trvani</label>
                <select
                  value={contractData.contract_duration}
                  onChange={(e) => setContractData({ ...contractData, contract_duration: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="neurcitou">neurcitou</option>
                  <option value="urcitou - 6 mesicu">urcitou - 6 mesicu</option>
                  <option value="urcitou - 1 rok">urcitou - 1 rok</option>
                  <option value="urcitou - 2 roky">urcitou - 2 roky</option>
                  <option value="urcitou - 3 roky">urcitou - 3 roky</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tydenni pracovni doba (hod)</label>
                <input
                  type="number"
                  value={contractData.weekly_hours}
                  onChange={(e) => setContractData({ ...contractData, weekly_hours: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  min={1}
                  max={60}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Mesicni hruba mzda (Kc)</label>
              <input
                type="number"
                value={contractData.salary}
                onChange={(e) => setContractData({ ...contractData, salary: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="35000"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nazev smlouvy *</label>
              <input
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Pracovni smlouva 2024"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Sablona (volitelne)</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">-- Bez sablony --</option>
                {contractTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Šablony typu "contract" vytvoříte v Administrace &gt; Šablony dokumentů
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-xs text-blue-400">
              Smlouva bude vytvořena jako koncept. Poté ji můžete upravit, odeslat k podpisu a archivovat.
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!viewingContract}
        onClose={() => setViewingContract(null)}
        title={viewingContract?.title || 'Detail smlouvy'}
        size="lg"
        footer={
          <>
            <button onClick={() => setViewingContract(null)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-lg transition">
              Zavřít
            </button>
            {viewingContract && viewingContract.status === 'draft' && (
              <button
                onClick={() => handleUpdateContractStatus(viewingContract.id, 'sent')}
                disabled={!!updatingContractStatus}
                className="px-4 py-2 text-sm font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition flex items-center gap-1.5"
              >
                {updatingContractStatus === viewingContract.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Odeslat k podpisu
              </button>
            )}
            {viewingContract && viewingContract.status === 'sent' && (
              <button
                onClick={() => handleUpdateContractStatus(viewingContract.id, 'signed')}
                disabled={!!updatingContractStatus}
                className="px-4 py-2 text-sm font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition flex items-center gap-1.5"
              >
                {updatingContractStatus === viewingContract.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                Oznacit jako podepsano
              </button>
            )}
            {viewingContract && viewingContract.status === 'signed' && (
              <button
                onClick={() => handleUpdateContractStatus(viewingContract.id, 'archived')}
                disabled={!!updatingContractStatus}
                className="px-4 py-2 text-sm font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition flex items-center gap-1.5"
              >
                {updatingContractStatus === viewingContract.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                Archivovat
              </button>
            )}
          </>
        }
      >
        {viewingContract && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {(() => {
                const statusCfg = CONTRACT_STATUS_CONFIG[viewingContract.status] || CONTRACT_STATUS_CONFIG.draft;
                const StatusIcon = statusCfg.icon;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${statusCfg.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {statusCfg.label}
                  </span>
                );
              })()}
              <span className="text-xs text-slate-500">
                Vytvoreno: {new Date(viewingContract.created_at).toLocaleDateString('cs-CZ')}
              </span>
              {viewingContract.signed_at && (
                <span className="text-xs text-emerald-400">
                  Podepsano: {new Date(viewingContract.signed_at).toLocaleDateString('cs-CZ')}
                </span>
              )}
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingContract.content.replace(/\n/g, '<br />')) }} />
              </div>
            </div>

            {canManageTeam && viewingContract.status === 'draft' && (
              <div className="flex justify-end">
                <button
                  onClick={() => handleDeleteContract(viewingContract.id)}
                  className="px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Smazat smlouvu
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function RolesTab({
  organization, roles, selectedRoleId, setSelectedRoleId, selectedRole,
  roleTab, setRoleTab, onNewRole, onEditRole, onDuplicateRole, onDeleteRole,
  deletingRole, onRefresh, currentUser, toast,
}: {
  organization: { id: string } | null;
  roles: CustomRole[];
  selectedRoleId: string | null;
  setSelectedRoleId: (id: string | null) => void;
  selectedRole: CustomRole | null;
  roleTab: 'roles' | 'assignments';
  setRoleTab: (t: 'roles' | 'assignments') => void;
  onNewRole: () => void;
  onEditRole: (r: CustomRole) => void;
  onDuplicateRole: (r: CustomRole) => void;
  onDeleteRole: (r: CustomRole) => void;
  deletingRole: string | null;
  onRefresh: () => void;
  currentUser: { id: string } | null;
  toast: (msg: string, type?: 'success' | 'error') => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Vytvářejte vlastní role, definujte přístup k modulům a datovým oprávněním, přiřazujte role členům týmu.
      </p>

      <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl w-fit">
        <button
          onClick={() => setRoleTab('roles')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition ${roleTab === 'roles' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Správa rolí
        </button>
        <button
          onClick={() => setRoleTab('assignments')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition ${roleTab === 'assignments' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Přiřazení rolí
        </button>
      </div>

      {roleTab === 'assignments' ? (
        <RoleAssignmentSection roles={roles} organizationId={organization?.id ?? ''} currentUser={currentUser} toast={toast} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Role ({roles.length})</span>
              <button
                onClick={onNewRole}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nová role
              </button>
            </div>

            {roles.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400 bg-navy-800/60 rounded-xl border border-white/[0.08]">
                Žádné role. Vytvořte první.
              </div>
            ) : (
              <div className="space-y-1.5">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition border ${
                      selectedRoleId === role.id
                        ? 'bg-white/[0.08] border-blue-500/30 ring-1 ring-blue-500/20'
                        : 'bg-white/[0.04] border-white/[0.06] hover:border-white/10'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/20 shadow" style={{ backgroundColor: role.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        {role.name}
                        {role.is_system && <Lock className="w-3 h-3 text-slate-400" />}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{role.description}</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition ${selectedRoleId === role.id ? 'text-blue-500' : 'text-slate-500'}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-8">
            {selectedRole ? (
              <RoleDetailPanel
                role={selectedRole}
                onEdit={() => onEditRole(selectedRole)}
                onDuplicate={() => onDuplicateRole(selectedRole)}
                onDelete={() => onDeleteRole(selectedRole)}
                deleting={deletingRole === selectedRole.id}
                onSavePermissions={async (perms) => {
                  const { error } = await supabase
                    .from('custom_roles')
                    .update({ permissions: perms, updated_at: new Date().toISOString() })
                    .eq('id', selectedRole.id);
                  if (error) {
                    toast('Chyba: ' + error.message, 'error');
                  } else {
                    toast('Oprávnění uložena');
                    await onRefresh();
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-64 bg-navy-800/60 rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                Vyberte roli pro zobrazení detailu
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleDetailPanel({
  role, onEdit, onDuplicate, onDelete, deleting, onSavePermissions,
}: {
  role: CustomRole;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  deleting: boolean;
  onSavePermissions: (perms: RolePermissions) => Promise<void>;
}) {
  const [perms, setPerms] = useState<RolePermissions>(role.permissions);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPerms(role.permissions);
    setDirty(false);
  }, [role.id, role.permissions]);

  const toggleModule = (key: ModuleKey) => {
    const updated = { ...perms, modules: { ...perms.modules, [key]: !perms.modules[key] } };
    setPerms(updated);
    setDirty(true);
  };

  const toggleData = (key: DataPermissionKey) => {
    const updated = { ...perms, data: { ...perms.data, [key]: !perms.data[key] } };
    setPerms(updated);
    setDirty(true);
  };

  const toggleAllModules = (val: boolean) => {
    const modules: Partial<Record<ModuleKey, boolean>> = {};
    MODULE_KEYS.forEach((k) => { modules[k] = val; });
    setPerms({ ...perms, modules });
    setDirty(true);
  };

  const toggleAllData = (val: boolean) => {
    const data: Partial<Record<DataPermissionKey, boolean>> = {};
    DATA_PERMISSION_GROUPS.forEach((g) => g.keys.forEach((k) => { data[k] = val; }));
    setPerms({ ...perms, data });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSavePermissions(perms);
    setDirty(false);
    setSaving(false);
  };

  const moduleCount = MODULE_KEYS.filter((k) => perms.modules[k]).length;
  const dataCount = DATA_PERMISSION_GROUPS.flatMap((g) => g.keys).filter((k) => perms.data[k]).length;
  const totalDataKeys = DATA_PERMISSION_GROUPS.flatMap((g) => g.keys).length;

  return (
    <div className="bg-navy-800/60 rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: role.color + '20', color: role.color }}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              {role.name}
              {role.is_system && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-500">Systémová</span>}
            </h2>
            <p className="text-xs text-slate-500">{role.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/[0.06] transition flex items-center gap-1">
            <Edit className="w-3.5 h-3.5" /> Upravit
          </button>
          <button onClick={onDuplicate} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/[0.06] transition flex items-center gap-1">
            <Copy className="w-3.5 h-3.5" /> Duplikovat
          </button>
          {!role.is_system && (
            <button onClick={onDelete} disabled={deleting} className="px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 transition flex items-center gap-1 disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Smazat
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-4 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Eye className="w-3.5 h-3.5" />
          Moduly: <span className="font-bold text-slate-300">{moduleCount}/{MODULE_KEYS.length}</span>
        </div>
        <div className="w-px h-4 bg-white/[0.08]" />
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Shield className="w-3.5 h-3.5" />
          Oprávnění: <span className="font-bold text-slate-300">{dataCount}/{totalDataKeys}</span>
        </div>
        {dirty && (
          <>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button onClick={() => { setPerms(role.permissions); setDirty(false); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-white/[0.06] transition flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Zahodit
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Uložit změny
              </button>
            </div>
          </>
        )}
      </div>

      <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Přístup k modulům</h3>
            <div className="flex gap-1">
              <button onClick={() => toggleAllModules(true)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition">Vše zapnout</button>
              <button onClick={() => toggleAllModules(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-300 px-2 py-1 rounded hover:bg-white/[0.04] transition">Vše vypnout</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {MODULE_KEYS.map((key) => {
              const enabled = perms.modules[key] === true;
              return (
                <button
                  key={key}
                  onClick={() => toggleModule(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition border ${enabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.04] border-white/[0.06] text-slate-400 hover:border-white/10'}`}
                >
                  {enabled ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{MODULE_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Datová oprávnění</h3>
            <div className="flex gap-1">
              <button onClick={() => toggleAllData(true)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition">Vše zapnout</button>
              <button onClick={() => toggleAllData(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-300 px-2 py-1 rounded hover:bg-white/[0.04] transition">Vše vypnout</button>
            </div>
          </div>

          <div className="space-y-2">
            {DATA_PERMISSION_GROUPS.map((group) => {
              const expanded = expandedGroups[group.group] !== false;
              const enabledCount = group.keys.filter((k) => perms.data[k]).length;
              return (
                <div key={group.group} className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.group]: !expanded }))}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                    <span className="text-xs font-bold text-slate-300 flex-1">{group.group}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${enabledCount === group.keys.length ? 'bg-emerald-500/10 text-emerald-400' : enabledCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/[0.06] text-slate-400'}`}>
                      {enabledCount}/{group.keys.length}
                    </span>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3 space-y-1">
                      {group.keys.map((key) => {
                        const enabled = perms.data[key] === true;
                        return (
                          <label key={key} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${enabled ? 'bg-emerald-500/10' : 'hover:bg-white/[0.04]'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${enabled ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>
                              {enabled && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <input type="checkbox" checked={enabled} onChange={() => toggleData(key)} className="sr-only" />
                            <span className={`text-xs font-medium ${enabled ? 'text-slate-300' : 'text-slate-500'}`}>
                              {DATA_PERMISSION_LABELS[key]}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleAssignmentSection({
  roles, organizationId, currentUser, toast,
}: {
  roles: CustomRole[];
  organizationId: string;
  currentUser: { id: string } | null;
  toast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [members, setMembers] = useState<MemberWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadMembers = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);

    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('id, user_id, role')
      .eq('organization_id', organizationId)
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
      .eq('organization_id', organizationId);

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
  }, [organizationId, roles]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleRoleChange = async (member: MemberWithRole, newRoleId: string) => {
    if (!organizationId || !currentUser) return;
    setChanging(member.userId);

    if (newRoleId === '') {
      if (member.assignmentId) {
        const { error } = await supabase.from('user_role_assignments').delete().eq('id', member.assignmentId);
        if (error) {
          toast('Chyba: ' + error.message, 'error');
        } else {
          toast('Role odebrána');
        }
      }
    } else if (member.assignmentId) {
      const { error } = await supabase.from('user_role_assignments').update({ role_id: newRoleId }).eq('id', member.assignmentId);
      if (error) {
        toast('Chyba: ' + error.message, 'error');
      } else {
        toast('Role aktualizována');
      }
    } else {
      const { error } = await supabase.from('user_role_assignments').insert({
        organization_id: organizationId,
        user_id: member.userId,
        role_id: newRoleId,
        assigned_by: currentUser.id,
      });
      if (error) {
        toast('Chyba: ' + error.message, 'error');
      } else {
        toast('Role přiřazena');
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

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-400 leading-relaxed">
          <strong>Jak to funguje:</strong> Každému členu týmu můžete přiřadit jednu roli z vašich vlastních rolí.
          Role určuje, ke kterým modulům a datům má uživatel přístup.
          Uživatelé s organizační rolí Admin/Majitel mají vždy plný přístup.
        </div>
      </div>

      <div className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-300">Členové týmu ({members.length})</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
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
              const isMe = m.userId === currentUser?.id;
              const isAdminOrOwner = m.orgRole === 'owner' || m.orgRole === 'admin';
              return (
                <div key={m.userId} className={`flex items-center gap-4 px-5 py-3.5 ${isMe ? 'bg-blue-500/10' : 'hover:bg-white/[0.04]'} transition`}>
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
                    {(m.displayName || m.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{m.displayName || m.email}</span>
                      {isMe && <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded-full">Vy</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{m.email}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">
                        {ORG_ROLE_LABELS[m.orgRole as OrgRole] || m.orgRole}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isAdminOrOwner ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400">
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
                      <div className="w-3 h-3 rounded-full ring-2 ring-white/20 shadow" style={{ backgroundColor: m.roleColor }} />
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

function RoleFormModal({
  role, duplicateFrom, organizationId, onClose, onSaved, toast,
}: {
  role: CustomRole | null;
  duplicateFrom: CustomRole | null;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const isEdit = !!role;
  const source = role ?? duplicateFrom;

  const [name, setName] = useState(source ? (isEdit ? source.name : source.name + ' (kopie)') : '');
  const [slug, setSlug] = useState(source ? (isEdit ? source.slug : '') : '');
  const [description, setDescription] = useState(source?.description ?? '');
  const [color, setColor] = useState(source?.color ?? '#0ea5e9');
  const [saving, setSaving] = useState(false);

  const generateSlug = (val: string) =>
    val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit) setSlug(generateSlug(val));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast('Zadejte název role', 'error');
      return;
    }
    const finalSlug = slug.trim() || generateSlug(name);
    if (!finalSlug) {
      toast('Slug nesmí být prázdný', 'error');
      return;
    }
    setSaving(true);

    if (isEdit && role) {
      const { error } = await supabase
        .from('custom_roles')
        .update({
          name: name.trim(),
          slug: finalSlug,
          description: description.trim(),
          color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', role.id);

      if (error) {
        toast('Chyba: ' + error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Role aktualizována');
    } else {
      const permissions = duplicateFrom ? duplicateFrom.permissions : getDefaultPermissions();
      const { error } = await supabase.from('custom_roles').insert({
        organization_id: organizationId,
        name: name.trim(),
        slug: finalSlug,
        description: description.trim(),
        color,
        is_system: false,
        permissions,
        sort_order: 99,
      });

      if (error) {
        if (error.message.includes('custom_roles_org_slug_unique')) {
          toast('Role s tímto slugem již existuje', 'error');
        } else {
          toast('Chyba: ' + error.message, 'error');
        }
        setSaving(false);
        return;
      }
      toast('Nová role vytvořena');
    }

    setSaving(false);
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Upravit roli' : duplicateFrom ? 'Duplikovat roli' : 'Nová role'}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Uložit' : 'Vytvořit'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Název role</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="např. Projektant, Obchodník..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Slug (identifikátor)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={isEdit && role?.is_system}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 font-mono text-xs"
            placeholder="projektant"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Popis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            placeholder="Co tato role umožňuje..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Barva</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-navy-900 ring-blue-400 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-white/10"
            />
          </div>
        </div>

        {duplicateFrom && (
          <div className="p-3 bg-blue-500/10 rounded-xl text-xs text-blue-400 font-medium">
            Oprávnění budou zkopírována z role "{duplicateFrom.name}". Po vytvoření je můžete upravit.
          </div>
        )}
      </div>
    </Modal>
  );
}
