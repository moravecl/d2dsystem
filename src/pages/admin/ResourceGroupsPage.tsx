import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  GripVertical, UserPlus, X, Save, Loader2, ToggleLeft, ToggleRight,
  Truck, Wrench, HardHat, User, Boxes, UserCog, Globe, Search
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';

const RESOURCE_TYPES = [
  { value: 'installation_team', label: 'Montážní tým', icon: HardHat, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { value: 'service_team', label: 'Servisní tým', icon: Wrench, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { value: 'design_team', label: 'Projekční tým', icon: UserCog, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { value: 'individual', label: 'Jednotlivec', icon: User, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { value: 'vehicle', label: 'Vozidlo', icon: Truck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { value: 'equipment', label: 'Vybavení', icon: Boxes, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  { value: 'external', label: 'Externista', icon: Globe, color: 'text-slate-400', bg: 'bg-slate-500/10' },
] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number]['value'];

const GROUP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16', '#64748b', '#a855f7',
];

interface ResourceGroupMember {
  id: string;
  profile_id: string;
  role: 'lead' | 'member';
  display_name: string;
  email: string;
}

interface ResourceGroup {
  id: string;
  name: string;
  type: ResourceType;
  color: string;
  is_active: boolean;
  capacity_hours_per_day: number;
  notes: string | null;
  sort_order: number;
  members: ResourceGroupMember[];
}

interface OrgMember {
  id: string;
  display_name: string;
  email: string;
}

const DEFAULT_FORM = {
  name: '',
  type: 'installation_team' as ResourceType,
  color: '#3b82f6',
  is_active: true,
  capacity_hours_per_day: 8,
  notes: '',
};

function getTypeInfo(type: string) {
  return RESOURCE_TYPES.find(t => t.value === type) || RESOURCE_TYPES[0];
}

export default function ResourceGroupsPage() {
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);

    const [groupsRes, membersRes, profilesRes] = await Promise.all([
      supabase.from('resource_groups').select('*').eq('organization_id', organization.id).order('sort_order').order('name'),
      supabase.from('resource_group_members').select('id, group_id, profile_id, role').eq('organization_id', organization.id),
      supabase.from('profiles').select('id, display_name, email'),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, { display_name: p.display_name || p.email, email: p.email }]));

    const enrichedGroups: ResourceGroup[] = (groupsRes.data || []).map((g: any) => ({
      ...g,
      members: (membersRes.data || [])
        .filter((m: any) => m.group_id === g.id)
        .map((m: any) => ({
          id: m.id,
          profile_id: m.profile_id,
          role: m.role,
          display_name: profileMap.get(m.profile_id)?.display_name || 'Neznámý',
          email: profileMap.get(m.profile_id)?.email || '',
        })),
    }));

    setGroups(enrichedGroups);
    setMembers((profilesRes.data || []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name || p.email,
      email: p.email,
    })));
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const startNew = () => {
    setForm({ ...DEFAULT_FORM });
    setEditingId('new');
    setExpandedId(null);
  };

  const startEdit = (g: ResourceGroup) => {
    setForm({
      name: g.name,
      type: g.type,
      color: g.color,
      is_active: g.is_active,
      capacity_hours_per_day: g.capacity_hours_per_day,
      notes: g.notes || '',
    });
    setEditingId(g.id);
    setExpandedId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const save = async () => {
    if (!form.name.trim() || !organization?.id) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      type: form.type,
      color: form.color,
      is_active: form.is_active,
      capacity_hours_per_day: form.capacity_hours_per_day,
      notes: form.notes.trim() || null,
      organization_id: organization.id,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId === 'new') {
      ({ error } = await supabase.from('resource_groups').insert({ ...payload, sort_order: groups.length }));
    } else {
      ({ error } = await supabase.from('resource_groups').update(payload).eq('id', editingId));
    }

    if (error) {
      toast('Chyba při ukládání', 'error');
    } else {
      toast(editingId === 'new' ? 'Skupina vytvořena' : 'Skupina uložena');
      setEditingId(null);
      loadData();
    }
    setSaving(false);
  };

  const deleteGroup = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('resource_groups').delete().eq('id', id);
    if (error) {
      toast('Chyba při mazání', 'error');
    } else {
      toast('Skupina smazána');
      loadData();
    }
    setDeletingId(null);
  };

  const toggleActive = async (g: ResourceGroup) => {
    await supabase.from('resource_groups').update({ is_active: !g.is_active }).eq('id', g.id);
    loadData();
  };

  const addMember = async (groupId: string, profileId: string) => {
    if (!organization?.id) return;
    const { error } = await supabase.from('resource_group_members').insert({
      group_id: groupId,
      profile_id: profileId,
      organization_id: organization.id,
      role: 'member',
    });
    if (error && error.code === '23505') {
      toast('Člen již ve skupině je', 'error');
    } else if (error) {
      toast('Chyba', 'error');
    } else {
      toast('Člen přidán');
      setMemberSearch('');
      loadData();
    }
  };

  const removeMember = async (memberId: string) => {
    await supabase.from('resource_group_members').delete().eq('id', memberId);
    toast('Člen odebrán');
    loadData();
  };

  const toggleMemberRole = async (memberId: string, currentRole: 'lead' | 'member') => {
    await supabase.from('resource_group_members').update({ role: currentRole === 'lead' ? 'member' : 'lead' }).eq('id', memberId);
    loadData();
  };

  const typeCounts = RESOURCE_TYPES.reduce((acc, t) => {
    acc[t.value] = groups.filter(g => g.type === t.value).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = groups.filter(g => {
    if (filterType !== 'all' && g.type !== filterType) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Skupiny zdrojů</h1>
          <p className="text-sm text-slate-400 mt-0.5">Týmy, vozidla, vybavení a externisté pro plánování montáží</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Přidat skupinu
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]'}`}
        >
          Vše ({groups.length})
        </button>
        {RESOURCE_TYPES.filter(t => typeCounts[t.value] > 0).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filterType === t.value ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]'}`}
            >
              <Icon className={`w-3 h-3 ${t.color}`} />
              {t.label} ({typeCounts[t.value]})
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hledat skupinu..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500"
        />
      </div>

      {editingId === 'new' && (
        <GroupForm
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={cancelEdit}
          saving={saving}
          isNew
        />
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">Žádné skupiny</p>
          <p className="text-slate-600 text-sm mt-1">Přidejte první skupinu zdrojů kliknutím na tlačítko výše</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(group => {
          const typeInfo = getTypeInfo(group.type);
          const TypeIcon = typeInfo.icon;
          const isEditing = editingId === group.id;
          const isExpanded = expandedId === group.id;

          return (
            <div
              key={group.id}
              className={`rounded-2xl border bg-white/[0.03] transition-all ${
                group.is_active ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'
              }`}
            >
              {isEditing ? (
                <div className="p-4">
                  <GroupForm
                    form={form}
                    setForm={setForm}
                    onSave={save}
                    onCancel={cancelEdit}
                    saving={saving}
                    isNew={false}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-4">
                    <GripVertical className="w-4 h-4 text-slate-600 shrink-0 cursor-grab" />

                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.bg}`}>
                      <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">{group.name}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeInfo.bg} ${typeInfo.color} shrink-0`}>
                          {typeInfo.label}
                        </span>
                        {!group.is_active && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 shrink-0">
                            Neaktivní
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {group.members.length > 0
                          ? group.members.map(m => m.display_name).join(' · ')
                          : 'Bez členů'}
                        {' — '}
                        {group.capacity_hours_per_day} h/den
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(group)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
                        title={group.is_active ? 'Deaktivovat' : 'Aktivovat'}
                      >
                        {group.is_active
                          ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                          : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setAddMemberGroupId(group.id === addMemberGroupId ? null : group.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
                        title="Přidat člena"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEdit(group)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteGroup(group.id)}
                        disabled={deletingId === group.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                      >
                        {deletingId === group.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                      {group.members.length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : group.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {addMemberGroupId === group.id && (
                    <MemberAdder
                      group={group}
                      allMembers={members}
                      memberSearch={memberSearch}
                      setMemberSearch={setMemberSearch}
                      onAdd={profileId => addMember(group.id, profileId)}
                      onClose={() => { setAddMemberGroupId(null); setMemberSearch(''); }}
                    />
                  )}

                  {isExpanded && group.members.length > 0 && (
                    <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-2">Členové</p>
                      <div className="space-y-1.5">
                        {group.members.map(m => (
                          <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-blue-400 uppercase">{m.display_name.slice(0, 2)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{m.display_name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                            </div>
                            <button
                              onClick={() => toggleMemberRole(m.id, m.role)}
                              className={`text-[9px] font-bold px-2 py-0.5 rounded transition ${
                                m.role === 'lead'
                                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                  : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]'
                              }`}
                            >
                              {m.role === 'lead' ? 'Vedoucí' : 'Člen'}
                            </button>
                            <button
                              onClick={() => removeMember(m.id)}
                              className="p-1 text-slate-600 hover:text-red-400 transition rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  form: typeof DEFAULT_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof DEFAULT_FORM>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
}) {
  return (
    <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-white">{isNew ? 'Nová skupina zdrojů' : 'Upravit skupinu'}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Název *</label>
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Tým Martin + Jirka"
            className="w-full px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-white placeholder-slate-500"
            onKeyDown={e => e.key === 'Enter' && onSave()}
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Typ zdroje</label>
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as ResourceType }))}
            className="w-full px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-white"
          >
            {RESOURCE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Kapacita (h/den)</label>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={form.capacity_hours_per_day}
            onChange={e => setForm(f => ({ ...f, capacity_hours_per_day: parseFloat(e.target.value) || 8 }))}
            className="w-full px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-white"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Barva v planneru</label>
          <div className="flex flex-wrap gap-2">
            {GROUP_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-navy-800 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Poznámka (volitelné)</label>
        <input
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Poznámka pro dispečera..."
          className="w-full px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-white placeholder-slate-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <span className="text-sm text-slate-300">Aktivní (zobrazit v planneru)</span>
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-semibold rounded-xl border border-white/[0.1] text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
        >
          Zrušit
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex-1 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isNew ? 'Vytvořit' : 'Uložit'}
        </button>
      </div>
    </div>
  );
}

function MemberAdder({
  group,
  allMembers,
  memberSearch,
  setMemberSearch,
  onAdd,
  onClose,
}: {
  group: ResourceGroup;
  allMembers: OrgMember[];
  memberSearch: string;
  setMemberSearch: (v: string) => void;
  onAdd: (profileId: string) => void;
  onClose: () => void;
}) {
  const existingIds = new Set(group.members.map(m => m.profile_id));
  const available = allMembers.filter(m => {
    if (existingIds.has(m.id)) return false;
    if (memberSearch && !m.display_name.toLowerCase().includes(memberSearch.toLowerCase()) && !m.email.toLowerCase().includes(memberSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Přidat člena</p>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
        <input
          autoFocus
          value={memberSearch}
          onChange={e => setMemberSearch(e.target.value)}
          placeholder="Hledat uživatele..."
          className="w-full pl-6 pr-3 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-white placeholder-slate-500"
        />
      </div>
      {available.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-3">
          {memberSearch ? 'Nikdo nenalezen' : 'Všichni jsou již ve skupině'}
        </p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {available.map(m => (
            <button
              key={m.id}
              onClick={() => onAdd(m.id)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-blue-500/10 transition group"
            >
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-slate-300 uppercase">{m.display_name.slice(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{m.display_name}</p>
                <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
              </div>
              <UserPlus className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
