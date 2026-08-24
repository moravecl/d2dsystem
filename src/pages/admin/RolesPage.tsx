import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, CreditCard as Edit, Copy, Loader2, Users, Check, ChevronDown, ChevronRight, Lock, Eye, EyeOff, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import type { CustomRole, RolePermissions, ModuleKey, DataPermissionKey } from '../../lib/permissions';
import { MODULE_KEYS, MODULE_LABELS, DATA_PERMISSION_GROUPS, DATA_PERMISSION_LABELS } from '../../lib/permissions';
import RoleFormModal from './RoleFormModal';
import RoleAssignmentSection from './RoleAssignmentSection';

export default function RolesPage() {
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<CustomRole | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tab, setTab] = useState<'roles' | 'assignments'>('roles');

  const loadRoles = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_roles')
      .select('*')
      .eq('organization_id', organization.id)
      .order('sort_order');
    if (error) {
      toast('Chyba při načítání rolí: ' + error.message, 'error');
    } else {
      setRoles((data ?? []) as CustomRole[]);
      if (!selectedRoleId && data && data.length > 0) {
        setSelectedRoleId(data[0].id);
      }
    }
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const handleDelete = async (role: CustomRole) => {
    if (role.is_system) {
      toast('Systémové role nelze smazat', 'error');
      return;
    }
    if (!confirm(`Opravdu smazat roli "${role.name}"? Uživatelé s touto rolí budou bez přiřazené role.`)) return;
    setDeleting(role.id);
    const { error } = await supabase.from('custom_roles').delete().eq('id', role.id);
    if (error) {
      toast('Chyba: ' + error.message, 'error');
    } else {
      toast('Role smazana');
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      await loadRoles();
    }
    setDeleting(null);
  };

  const handleDuplicate = (role: CustomRole) => {
    setDuplicateSource(role);
    setShowNewModal(true);
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          Role a oprávnění
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Vytvářejte vlastní role, definujte přístup k modulům a datovým oprávněním, přiřazujte role členům týmu.
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.06] p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('roles')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
            tab === 'roles' ? 'bg-white/[0.06] text-white ' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Správa rolí
        </button>
        <button
          onClick={() => setTab('assignments')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
            tab === 'assignments' ? 'bg-white/[0.06] text-white ' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Přiřazení rolí
        </button>
      </div>

      {tab === 'assignments' ? (
        <RoleAssignmentSection roles={roles} onRefreshRoles={loadRoles} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Role ({roles.length})
              </span>
              <button
                onClick={() => { setDuplicateSource(null); setShowNewModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nová role
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : roles.length === 0 ? (
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
                        ? 'bg-white/[0.06] border-blue-200 ring-1 ring-blue-100'
                        : 'bg-white/[0.06] border-white/[0.06] hover:border-white/10 hover:'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow"
                      style={{ backgroundColor: role.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        {role.name}
                        {role.is_system && <Lock className="w-3 h-3 text-slate-400" />}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{role.description}</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition ${
                      selectedRoleId === role.id ? 'text-blue-500' : 'text-slate-300'
                    }`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-8">
            {selectedRole ? (
              <RoleDetailPanel
                role={selectedRole}
                onEdit={() => setEditingRole(selectedRole)}
                onDuplicate={() => handleDuplicate(selectedRole)}
                onDelete={() => handleDelete(selectedRole)}
                deleting={deleting === selectedRole.id}
                onSavePermissions={async (perms) => {
                  const { error } = await supabase
                    .from('custom_roles')
                    .update({ permissions: perms, updated_at: new Date().toISOString() })
                    .eq('id', selectedRole.id);
                  if (error) {
                    toast('Chyba: ' + error.message, 'error');
                  } else {
                    toast('Oprávnění uložena');
                    await loadRoles();
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

      {(showNewModal || editingRole) && (
        <RoleFormModal
          role={editingRole}
          duplicateFrom={duplicateSource}
          organizationId={organization?.id ?? ''}
          onClose={() => { setShowNewModal(false); setEditingRole(null); setDuplicateSource(null); }}
          onSaved={async () => {
            setShowNewModal(false);
            setEditingRole(null);
            setDuplicateSource(null);
            await loadRoles();
          }}
        />
      )}
    </div>
  );
}

function RoleDetailPanel({
  role,
  onEdit,
  onDuplicate,
  onDelete,
  deleting,
  onSavePermissions,
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
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center "
            style={{ backgroundColor: role.color + '20', color: role.color }}
          >
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              {role.name}
              {role.is_system && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-500">
                  Systémová
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">{role.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/[0.06] transition flex items-center gap-1"
          >
            <Edit className="w-3.5 h-3.5" /> Upravit
          </button>
          <button
            onClick={onDuplicate}
            className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/[0.06] transition flex items-center gap-1"
          >
            <Copy className="w-3.5 h-3.5" /> Duplikovat
          </button>
          {!role.is_system && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/100/10 transition flex items-center gap-1 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Smazat
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-4 bg-white/[0.04]/50">
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
              <button
                onClick={() => { setPerms(role.permissions); setDirty(false); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-white/[0.06] transition flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Zahodit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1 disabled:opacity-50"
              >
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
              <button onClick={() => toggleAllModules(true)} className="text-[10px] font-bold text-blue-400 hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-500/100/10 transition">
                Vse zapnout
              </button>
              <button onClick={() => toggleAllModules(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-400 px-2 py-1 rounded hover:bg-white/[0.04] transition">
                Vse vypnout
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {MODULE_KEYS.map((key) => {
              const enabled = perms.modules[key] === true;
              return (
                <button
                  key={key}
                  onClick={() => toggleModule(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition border ${
                    enabled
                      ? 'bg-emerald-500/10 border-emerald-200 text-emerald-700'
                      : 'bg-white/[0.04] border-white/[0.06] text-slate-400 hover:border-white/10'
                  }`}
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
              <button onClick={() => toggleAllData(true)} className="text-[10px] font-bold text-blue-400 hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-500/100/10 transition">
                Vse zapnout
              </button>
              <button onClick={() => toggleAllData(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-400 px-2 py-1 rounded hover:bg-white/[0.04] transition">
                Vse vypnout
              </button>
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      enabledCount === group.keys.length
                        ? 'bg-emerald-500/10 text-emerald-700'
                        : enabledCount > 0
                          ? 'bg-amber-500/10 text-amber-700'
                          : 'bg-white/[0.06] text-slate-400'
                    }`}>
                      {enabledCount}/{group.keys.length}
                    </span>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3 space-y-1">
                      {group.keys.map((key) => {
                        const enabled = perms.data[key] === true;
                        return (
                          <label
                            key={key}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                              enabled ? 'bg-emerald-500/10/60' : 'hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                              enabled ? 'bg-emerald-500/100 border-emerald-500' : 'border-slate-300'
                            }`}>
                              {enabled && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => toggleData(key)}
                              className="sr-only"
                            />
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
