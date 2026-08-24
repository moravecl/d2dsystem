import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Trash2, Loader2, RefreshCw, Mail, Crown, Shield, Eye, Wrench, User, AlertTriangle, X, Phone, MapPin, Calendar, Briefcase, Clock, Cake, FileText, ChevronRight, CreditCard as Edit2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { sendTeamInviteEmail } from '../../lib/transactionalEmail';

type OrgRole = 'owner' | 'admin' | 'manager' | 'employee' | 'viewer';

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Majitel',
  admin: 'Admin',
  manager: 'Manažer',
  employee: 'Zaměstnanec',
  viewer: 'Čtenář',
};

const ROLE_ICONS: Record<OrgRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  manager: Wrench,
  employee: User,
  viewer: Eye,
};

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  admin: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  manager: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  employee: 'bg-white/[0.06] text-slate-400 border-white/10',
  viewer: 'bg-white/[0.06] text-slate-500 border-white/10',
};

interface Profile {
  id: string;
  display_name: string;
  email: string;
  is_portal_client: boolean;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  job_position: string | null;
  monthly_work_hours_fund: number | null;
  vacation_days_per_year: number | null;
}

interface Member {
  id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string | null;
  invited_at: string | null;
  profile: Profile | null;
}

interface DocumentTemplate {
  id: string;
  name: string;
  template_type: string;
  content: string;
}

function isBirthdaySoon(birthDate: string | null): { isSoon: boolean; daysUntil: number; isToday: boolean } {
  if (!birthDate) return { isSoon: false, daysUntil: -1, isToday: false };
  const today = new Date();
  const birth = new Date(birthDate);
  const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (thisYearBirthday < today) {
    thisYearBirthday.setFullYear(today.getFullYear() + 1);
  }
  const diffTime = thisYearBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    isSoon: diffDays <= 7,
    daysUntil: diffDays,
    isToday: diffDays === 0,
  };
}

export default function TeamPage() {
  const { user } = useAuth();
  const { organization, canManageTeam } = useOrganization();
  const { toast } = useToast();
  const planLimits = usePlanLimits();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('employee');
  const [inviting, setInviting] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  const [contractTemplates, setContractTemplates] = useState<DocumentTemplate[]>([]);
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [generatingContract, setGeneratingContract] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!organization) return;
    setLoading(true);

    const { data: orgMembers, error } = await supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at, invited_at')
      .eq('organization_id', organization.id)
      .order('created_at');

    if (error) {
      toast('Chyba při načítání členů: ' + error.message, 'error');
      setLoading(false);
      return;
    }

    const userIds = (orgMembers || []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_portal_client, phone, address, birth_date, job_position, monthly_work_hours_fund, vacation_days_per_year')
      .in('id', userIds);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    setMembers(
      (orgMembers || []).map((m) => ({
        ...m,
        role: m.role as OrgRole,
        profile: profileMap[m.user_id] ?? null,
      }))
    );
    setLoading(false);
  }, [organization?.id]);

  const loadContractTemplates = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from('document_templates')
      .select('id, name, template_type, content')
      .eq('organization_id', organization.id)
      .eq('template_type', 'contract')
      .eq('is_active', true);
    setContractTemplates(data || []);
  }, [organization?.id]);

  useEffect(() => {
    loadMembers();
    loadContractTemplates();
  }, [loadMembers, loadContractTemplates]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !organization) return;

    if (!planLimits.canAddUser) {
      toast(`Dosáhli jste limitu ${planLimits.maxUsers} uživatelů pro plán ${organization.subscription_tier}.`, 'error');
      return;
    }

    setInviting(true);

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, organization_id, is_portal_client')
      .eq('email', inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (!existingProfile) {
      toast('Uživatel s tímto emailem neexistuje. Nejprve musí vytvořit účet.', 'error');
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

    const alreadyMember = members.some((m) => m.user_id === existingProfile.id);
    if (alreadyMember) {
      toast('Uživatel je již členem této organizace.', 'error');
      setInviting(false);
      return;
    }

    const { error: memberError } = await supabase.from('organization_members').insert({
      organization_id: organization.id,
      user_id: existingProfile.id,
      role: inviteRole,
      invited_by: user?.id,
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

    toast(`${inviteEmail} byl přidán do týmu.`, 'success');
    setInviteEmail('');

    sendTeamInviteEmail({
      organizationId: organization.id,
      organizationName: organization.name,
      inviterName: user?.email ?? 'Administrator',
      recipientEmail: inviteEmail.trim(),
      role: inviteRole,
    }).catch(() => {});

    await loadMembers();
    setInviting(false);
  };

  const handleRoleChange = async (member: Member, newRole: OrgRole) => {
    if (member.user_id === user?.id) {
      toast('Nemůžete změnit vlastní roli.', 'error');
      return;
    }
    setChangingRole(member.id);
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', member.id);

    if (error) {
      toast('Chyba: ' + error.message, 'error');
    } else {
      toast('Role aktualizovana.', 'success');
      await loadMembers();
    }
    setChangingRole(null);
  };

  const handleRemove = async (memberId: string, userId: string) => {
    if (userId === user?.id) {
      toast('Nemůžete odebrat sebe z organizace.', 'error');
      return;
    }
    if (!confirm('Opravdu odebrat tohoto člena?')) return;
    setRemoving(memberId);

    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) {
      toast('Chyba: ' + error.message, 'error');
    } else {
      await supabase.from('profiles').update({ organization_id: null }).eq('id', userId);
      toast('Člen odebrán.', 'success');
      await loadMembers();
    }
    setRemoving(null);
  };

  const openMemberDetail = (member: Member) => {
    setSelectedMember(member);
    setEditMode(false);
    setEditData({
      display_name: member.profile?.display_name || '',
      phone: member.profile?.phone || '',
      address: member.profile?.address || '',
      birth_date: member.profile?.birth_date || '',
      job_position: member.profile?.job_position || '',
      monthly_work_hours_fund: member.profile?.monthly_work_hours_fund ?? 168,
      vacation_days_per_year: member.profile?.vacation_days_per_year ?? 20,
    });
  };

  const handleSaveProfile = async () => {
    if (!selectedMember?.profile) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: editData.display_name,
        phone: editData.phone || null,
        address: editData.address || null,
        birth_date: editData.birth_date || null,
        job_position: editData.job_position || null,
        monthly_work_hours_fund: editData.monthly_work_hours_fund,
        vacation_days_per_year: editData.vacation_days_per_year,
      })
      .eq('id', selectedMember.profile.id);

    if (error) {
      toast('Chyba při ukládání: ' + error.message, 'error');
    } else {
      toast('Profil uložen.', 'success');
      setEditMode(false);
      await loadMembers();
      const updated = members.find(m => m.user_id === selectedMember.user_id);
      if (updated) {
        setSelectedMember({
          ...selectedMember,
          profile: { ...selectedMember.profile, ...editData } as Profile,
        });
      }
    }
    setSaving(false);
  };

  const handleGenerateContract = async () => {
    if (!selectedMember?.profile || !selectedTemplate || !organization) return;
    setGeneratingContract(true);

    const template = contractTemplates.find(t => t.id === selectedTemplate);
    if (!template) {
      toast('Šablona nenalezena', 'error');
      setGeneratingContract(false);
      return;
    }

    const { data: companyInfo } = await supabase
      .from('company_info')
      .select('*')
      .eq('organization_id', organization.id)
      .maybeSingle();

    const profile = selectedMember.profile;
    const content = template.content
      .replace(/\{\{company_name\}\}/g, companyInfo?.name || organization.name)
      .replace(/\{\{company_ico\}\}/g, companyInfo?.ico || '')
      .replace(/\{\{company_address\}\}/g, companyInfo?.address || '')
      .replace(/\{\{employee_name\}\}/g, profile.display_name || '')
      .replace(/\{\{employee_birth_date\}\}/g, profile.birth_date ? new Date(profile.birth_date).toLocaleDateString('cs-CZ') : '')
      .replace(/\{\{employee_address\}\}/g, profile.address || '')
      .replace(/\{\{job_position\}\}/g, profile.job_position || '')
      .replace(/\{\{vacation_days\}\}/g, String(profile.vacation_days_per_year || 20))
      .replace(/\{\{weekly_hours\}\}/g, '40')
      .replace(/\{\{work_location\}\}/g, companyInfo?.address || '')
      .replace(/\{\{start_date\}\}/g, new Date().toLocaleDateString('cs-CZ'))
      .replace(/\{\{contract_duration\}\}/g, 'neurčitou')
      .replace(/\{\{salary\}\}/g, '_________');

    const { error } = await supabase.from('employee_contracts').insert({
      employee_id: profile.id,
      template_id: template.id,
      title: `Pracovní smlouva - ${profile.display_name}`,
      content,
      status: 'draft',
      organization_id: organization.id,
    });

    if (error) {
      toast('Chyba při generování smlouvy: ' + error.message, 'error');
    } else {
      toast('Smlouva vygenerována.', 'success');
      setShowContractModal(false);

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Pracovni smlouva - ${profile.display_name}</title>
            <style>
              body { font-family: Arial, sans-serif; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>${content}</body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 300);
      }
    }
    setGeneratingContract(false);
  };

  const upcomingBirthdays = members.filter(m => {
    const bd = isBirthdaySoon(m.profile?.birth_date || null);
    return bd.isSoon;
  }).sort((a, b) => {
    const bdA = isBirthdaySoon(a.profile?.birth_date || null);
    const bdB = isBirthdaySoon(b.profile?.birth_date || null);
    return bdA.daysUntil - bdB.daysUntil;
  });

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-64 text-slate-500 text-sm">
        Organizace nenalezena.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            Správa týmu
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Organizace: <strong className="text-slate-300">{organization.name}</strong>
          </p>
          {!planLimits.loading && (
            <div className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              planLimits.canAddUser ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}>
              {!planLimits.canAddUser && <AlertTriangle className="w-3 h-3" />}
              <Users className="w-3 h-3" />
              {planLimits.userCount} / {planLimits.maxUsers >= 999 ? '\u221E' : planLimits.maxUsers}
            </div>
          )}
        </div>
        <button
          onClick={loadMembers}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {upcomingBirthdays.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-3">
            <Cake className="w-4 h-4" />
            Blížící se narozeniny
          </div>
          <div className="flex flex-wrap gap-3">
            {upcomingBirthdays.map(m => {
              const bd = isBirthdaySoon(m.profile?.birth_date || null);
              return (
                <div
                  key={m.id}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    bd.isToday ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.04] text-slate-300'
                  }`}
                >
                  <span className="font-medium">{m.profile?.display_name}</span>
                  <span className="text-slate-500 ml-2">
                    {bd.isToday ? 'Dnes!' : `za ${bd.daysUntil} dni`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canManageTeam && (
        <div className="bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-5">
          <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-400" />
            Přidat člena
          </h2>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="email@uzivatele.cz"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.06] text-sm font-medium text-slate-300 focus:outline-none"
            >
              {(['admin', 'manager', 'employee', 'viewer'] as OrgRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition disabled:opacity-40 flex items-center gap-2 shrink-0"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Přidat
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : members.length === 0 ? (
          <div className="col-span-full text-center py-12 text-sm text-slate-500">
            Zatím žádní členové.
          </div>
        ) : (
          members.map((m) => {
            const RoleIcon = ROLE_ICONS[m.role];
            const isMe = m.user_id === user?.id;
            const bd = isBirthdaySoon(m.profile?.birth_date || null);

            return (
              <div
                key={m.id}
                onClick={() => openMemberDetail(m)}
                className={`bg-navy-800/60 backdrop-blur-sm rounded-xl border border-white/[0.08] p-4 cursor-pointer hover:bg-white/[0.04] transition group ${
                  isMe ? 'ring-1 ring-blue-500/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border border-white/10 flex items-center justify-center text-lg font-bold text-white shrink-0">
                    {(m.profile?.display_name || m.profile?.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {m.profile?.display_name || m.profile?.email || m.user_id}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full">Vy</span>
                      )}
                      {bd.isSoon && (
                        <Cake className={`w-3.5 h-3.5 ${bd.isToday ? 'text-amber-400' : 'text-amber-500/60'}`} />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{m.profile?.email}</p>
                    {m.profile?.job_position && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{m.profile.job_position}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition shrink-0" />
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[m.role]}`}>
                    <RoleIcon className="w-3 h-3" />
                    {ROLE_LABELS[m.role]}
                  </div>
                  {m.profile?.phone && (
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {m.profile.phone}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-navy-900 rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-navy-900 border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Detail zaměstnance</h2>
              <div className="flex items-center gap-2">
                {canManageTeam && !editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-white/10 flex items-center justify-center text-2xl font-bold text-white">
                  {(selectedMember.profile?.display_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  {editMode ? (
                    <input
                      type="text"
                      value={editData.display_name || ''}
                      onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                      className="text-xl font-bold text-white bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  ) : (
                    <h3 className="text-xl font-bold text-white">{selectedMember.profile?.display_name}</h3>
                  )}
                  <p className="text-slate-400">{selectedMember.profile?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      <Phone className="w-3.5 h-3.5" /> Telefon
                    </label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="+420 123 456 789"
                      />
                    ) : (
                      <p className="text-white">{selectedMember.profile?.phone || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Adresa
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.address || ''}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Ulice 123, Město"
                      />
                    ) : (
                      <p className="text-white">{selectedMember.profile?.address || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Datum narození
                    </label>
                    {editMode ? (
                      <input
                        type="date"
                        value={editData.birth_date || ''}
                        onChange={(e) => setEditData({ ...editData, birth_date: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <p className="text-white">
                        {selectedMember.profile?.birth_date
                          ? new Date(selectedMember.profile.birth_date).toLocaleDateString('cs-CZ')
                          : '-'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      <Briefcase className="w-3.5 h-3.5" /> Pracovní pozice
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.job_position || ''}
                        onChange={(e) => setEditData({ ...editData, job_position: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Elektrikář, Projektant..."
                      />
                    ) : (
                      <p className="text-white">{selectedMember.profile?.job_position || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      <Clock className="w-3.5 h-3.5" /> Měsíční fond hodin
                    </label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editData.monthly_work_hours_fund || 168}
                        onChange={(e) => setEditData({ ...editData, monthly_work_hours_fund: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <p className="text-white">{selectedMember.profile?.monthly_work_hours_fund || 168} hod</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Dovolená za rok
                    </label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editData.vacation_days_per_year || 20}
                        onChange={(e) => setEditData({ ...editData, vacation_days_per_year: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <p className="text-white">{selectedMember.profile?.vacation_days_per_year || 20} dni</p>
                    )}
                  </div>
                </div>
              </div>

              {editMode && (
                <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.08]">
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Uložit
                  </button>
                </div>
              )}

              {!editMode && canManageTeam && (
                <div className="pt-4 border-t border-white/[0.08]">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Akce</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowContractModal(true)}
                      className="px-3 py-2 bg-emerald-600/20 text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-600/30 transition flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Generovat smlouvu
                    </button>

                    {selectedMember.user_id !== user?.id && selectedMember.role !== 'owner' && (
                      <>
                        <select
                          value={selectedMember.role}
                          onChange={(e) => handleRoleChange(selectedMember, e.target.value as OrgRole)}
                          disabled={!!changingRole}
                          className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none"
                        >
                          {(['admin', 'manager', 'employee', 'viewer'] as OrgRole[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleRemove(selectedMember.id, selectedMember.user_id)}
                          disabled={!!removing}
                          className="px-3 py-2 bg-red-600/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-600/30 transition flex items-center gap-2"
                        >
                          {removing === selectedMember.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Odebrat
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showContractModal && selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-navy-900 rounded-xl border border-white/10 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Generovat pracovní smlouvu</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Zaměstnanec</label>
                <p className="text-white font-medium">{selectedMember.profile?.display_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Šablona smlouvy</label>
                {contractTemplates.length === 0 ? (
                  <p className="text-sm text-amber-400">Žádné šablony smluv. Vytvořte šablonu v Dokumenty &rarr; Šablony s typem "contract".</p>
                ) : (
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none"
                  >
                    <option value="">Vyberte šablonu...</option>
                    {contractTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowContractModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
              >
                Zrušit
              </button>
              <button
                onClick={handleGenerateContract}
                disabled={!selectedTemplate || generatingContract}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500 transition disabled:opacity-50 flex items-center gap-2"
              >
                {generatingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generovat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
