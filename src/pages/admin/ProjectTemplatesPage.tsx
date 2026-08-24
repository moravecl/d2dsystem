import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, Copy, FolderOpen, ChevronDown, ChevronRight,
  Flag, ListChecks, Settings2, Folder, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';

interface TemplateFolder {
  id: string;
  template_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  default_status: string;
  is_active: boolean;
  created_at: string;
  milestones: TemplateMilestone[];
  tasks: TemplateTask[];
  customFields: TemplateCustomField[];
  folders: TemplateFolder[];
}

interface TemplateMilestone {
  id: string;
  template_id: string;
  name: string;
  offset_days: number;
  duration_days: number;
  color: string;
  sort_order: number;
}

interface TemplateTask {
  id: string;
  template_id: string;
  milestone_index: number;
  title: string;
  description: string;
  priority: string;
  sort_order: number;
}

interface TemplateCustomField {
  id: string;
  template_id: string;
  field_id: string;
  default_value: string;
}

interface FieldDef {
  id: string;
  name: string;
  field_type: string;
  options: string[];
  section: string;
}

const STATUSES = [
  { value: 'lead', label: 'Lead / Poptávka' },
  { value: 'design', label: 'Návrh' },
  { value: 'quote', label: 'Nabídka' },
  { value: 'in_progress', label: 'Realizace' },
];

const PRIORITIES = [
  { value: 'low', label: 'Nízká' },
  { value: 'medium', label: 'Střední' },
  { value: 'high', label: 'Vysoká' },
  { value: 'urgent', label: 'Urgentní' },
];

const MILESTONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

export default function ProjectTemplatesPage() {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const orgId = organization?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    const [tplRes, fieldRes] = await Promise.all([
      supabase.from('project_templates').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
      supabase.from('custom_field_definitions').select('*').eq('organization_id', orgId).eq('is_active', true).order('section').order('position'),
    ]);

    const tpls = (tplRes.data || []) as any[];
    const tplIds = tpls.map((t) => t.id);

    let allMilestones: TemplateMilestone[] = [];
    let allTasks: TemplateTask[] = [];
    let allCf: TemplateCustomField[] = [];
    let allFolders: TemplateFolder[] = [];

    if (tplIds.length > 0) {
      const [msRes, tsRes, cfRes, fldRes] = await Promise.all([
        supabase.from('template_milestones').select('*').in('template_id', tplIds).order('sort_order'),
        supabase.from('template_tasks').select('*').in('template_id', tplIds).order('sort_order'),
        supabase.from('template_custom_fields').select('*').in('template_id', tplIds),
        supabase.from('template_folders').select('*').in('template_id', tplIds).order('sort_order'),
      ]);
      allMilestones = (msRes.data || []) as TemplateMilestone[];
      allTasks = (tsRes.data || []) as TemplateTask[];
      allCf = (cfRes.data || []) as TemplateCustomField[];
      allFolders = (fldRes.data || []) as TemplateFolder[];
    }

    setTemplates(tpls.map((t) => ({
      ...t,
      milestones: allMilestones.filter((m) => m.template_id === t.id),
      tasks: allTasks.filter((tk) => tk.template_id === t.id),
      customFields: allCf.filter((cf) => cf.template_id === t.id),
      folders: allFolders.filter((f) => f.template_id === t.id),
    })));
    setFieldDefs((fieldRes.data || []) as FieldDef[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('project_templates').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    toast('Šablona smazána', 'success');
    load();
  };

  const handleDuplicate = async (tpl: Template) => {
    if (!orgId) return;
    const { data: newTpl } = await supabase.from('project_templates')
      .insert({ organization_id: orgId, name: `${tpl.name} (kopie)`, description: tpl.description, default_status: tpl.default_status })
      .select('*').maybeSingle();
    if (!newTpl) { toast('Chyba při duplikaci', 'error'); return; }

    if (tpl.milestones.length > 0) {
      await supabase.from('template_milestones').insert(
        tpl.milestones.map((m) => ({ template_id: newTpl.id, name: m.name, offset_days: m.offset_days, duration_days: m.duration_days, color: m.color, sort_order: m.sort_order }))
      );
    }
    if (tpl.tasks.length > 0) {
      await supabase.from('template_tasks').insert(
        tpl.tasks.map((t) => ({ template_id: newTpl.id, milestone_index: t.milestone_index, title: t.title, description: t.description, priority: t.priority, sort_order: t.sort_order }))
      );
    }
    if (tpl.customFields.length > 0) {
      await supabase.from('template_custom_fields').insert(
        tpl.customFields.map((cf) => ({ template_id: newTpl.id, field_id: cf.field_id, default_value: cf.default_value }))
      );
    }
    if (tpl.folders.length > 0) {
      const rootFolders = tpl.folders.filter((f) => !f.parent_id);
      const insertFoldersRecursive = async (sourceFolders: TemplateFolder[], parentId: string | null) => {
        for (const sf of sourceFolders) {
          const { data: newFolder } = await supabase.from('template_folders')
            .insert({ template_id: newTpl.id, parent_id: parentId, name: sf.name, sort_order: sf.sort_order })
            .select('id').maybeSingle();
          if (newFolder) {
            const children = tpl.folders.filter((f) => f.parent_id === sf.id);
            if (children.length > 0) await insertFoldersRecursive(children, newFolder.id);
          }
        }
      };
      await insertFoldersRecursive(rootFolders, null);
    }
    toast('Šablona duplikována', 'success');
    load();
  };

  const filtered = templates.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-navy-800/60 rounded-xl border border-white/[0.08] animate-pulse" />)}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Šablony projektů</h1>
          <p className="text-sm text-slate-500 mt-1">Předpřipravené sady milníků, úkolů a vlastních polí pro nové projekty</p>
        </div>
        <button
          onClick={() => { setEditTemplate(null); setEditorOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nová šablona
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat šablonu..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">{templates.length === 0 ? 'Zatím žádné šablony. Vytvořte první!' : 'Žádné šablony neodpovídají filtru'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tpl) => {
            const expanded = expandedId === tpl.id;
            return (
              <div key={tpl.id} className="bg-navy-800/60 rounded-xl border border-white/[0.08] overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04]/50 transition">
                  <button onClick={() => setExpandedId(expanded ? null : tpl.id)} className="p-1 text-slate-400 hover:text-slate-400 transition">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{tpl.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-500">
                        {tpl.milestones.length} milníků
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-500">
                        {tpl.tasks.length} úkolů
                      </span>
                      {tpl.folders.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                          {tpl.folders.length} složek
                        </span>
                      )}
                      {tpl.customFields.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-500">
                          {tpl.customFields.length} polí
                        </span>
                      )}
                    </div>
                    {tpl.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{tpl.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditTemplate(tpl); setEditorOpen(true); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition" title="Upravit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDuplicate(tpl)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition" title="Duplikovat">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(tpl)} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-red-400 transition" title="Smazat">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.04]/50 space-y-4">
                    {tpl.milestones.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Flag className="w-3.5 h-3.5" /> Milníky
                        </h4>
                        <div className="space-y-1.5">
                          {tpl.milestones.map((m, _i) => (
                            <div key={m.id} className="flex items-center gap-3 text-sm">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                              <span className="font-semibold text-slate-300">{m.name}</span>
                              <span className="text-xs text-slate-400">Den {m.offset_days} - {m.offset_days + m.duration_days} ({m.duration_days} dní)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {tpl.tasks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ListChecks className="w-3.5 h-3.5" /> Úkoly
                        </h4>
                        <div className="space-y-1">
                          {tpl.tasks.map((t) => {
                            const ms = t.milestone_index >= 0 ? tpl.milestones.find((m) => m.sort_order === t.milestone_index) : null;
                            return (
                              <div key={t.id} className="flex items-center gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                <span className="font-medium text-slate-300">{t.title}</span>
                                {ms && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-500">{ms.name}</span>}
                                <span className="text-[10px] text-slate-400">{PRIORITIES.find((p) => p.value === t.priority)?.label || t.priority}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {tpl.folders.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5" /> Složky
                        </h4>
                        <FolderTreePreview folders={tpl.folders} parentId={null} depth={0} />
                      </div>
                    )}
                    {tpl.customFields.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Settings2 className="w-3.5 h-3.5" /> Výchozí hodnoty polí
                        </h4>
                        <div className="space-y-1">
                          {tpl.customFields.map((cf) => {
                            const fd = fieldDefs.find((f) => f.id === cf.field_id);
                            return (
                              <div key={cf.id} className="flex items-center gap-3 text-sm">
                                <span className="text-slate-500">{fd?.name || '?'}</span>
                                <span className="font-medium text-slate-300">{cf.default_value || '(prázdné)'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editorOpen && (
        <TemplateEditorModal
          template={editTemplate}
          fieldDefs={fieldDefs}
          orgId={orgId!}
          onClose={() => { setEditorOpen(false); setEditTemplate(null); }}
          onSaved={() => { setEditorOpen(false); setEditTemplate(null); load(); }}
        />
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Smazat šablonu" size="sm"
        footer={<>
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] rounded-lg transition">Zrušit</button>
          <button onClick={handleDelete} className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition">Smazat</button>
        </>}
      >
        <p className="text-sm text-slate-400">Šablona "{deleteTarget?.name}" a všechny její milníky a úkoly budou smazány.</p>
      </Modal>
    </div>
  );
}

interface EditFolder {
  _tempId: string;
  parentTempId: string | null;
  name: string;
  sort_order: number;
}

let _folderId = 0;
function nextFolderId() { return `_tf_${++_folderId}_${Date.now()}`; }

function buildEditFolders(folders: TemplateFolder[]): EditFolder[] {
  const idMap = new Map<string, string>();
  const result: EditFolder[] = [];
  folders.forEach((f) => {
    const tempId = nextFolderId();
    idMap.set(f.id, tempId);
    result.push({ _tempId: tempId, parentTempId: null, name: f.name, sort_order: f.sort_order });
  });
  folders.forEach((f, i) => {
    if (f.parent_id) {
      result[i].parentTempId = idMap.get(f.parent_id) || null;
    }
  });
  return result;
}

function FolderTreePreview({ folders, parentId, depth }: { folders: TemplateFolder[]; parentId: string | null; depth: number }) {
  const children = folders.filter((f) => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
  if (children.length === 0) return null;
  return (
    <div className={depth > 0 ? 'ml-5' : ''}>
      {children.map((f) => (
        <div key={f.id}>
          <div className="flex items-center gap-2 py-1 text-sm">
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-medium text-slate-300">{f.name}</span>
          </div>
          <FolderTreePreview folders={folders} parentId={f.id} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

function EditFolderTree({
  folders,
  parentTempId,
  depth,
  onAdd,
  onRemove,
  onRename,
}: {
  folders: EditFolder[];
  parentTempId: string | null;
  depth: number;
  onAdd: (parentTempId: string | null) => void;
  onRemove: (tempId: string) => void;
  onRename: (tempId: string, name: string) => void;
}) {
  const children = folders.filter((f) => f.parentTempId === parentTempId).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-white/10 pl-3' : ''}>
      {children.map((f) => (
        <div key={f._tempId}>
          <div className="flex items-center gap-2 py-1.5 group">
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            <input
              value={f.name}
              onChange={(e) => onRename(f._tempId, e.target.value)}
              placeholder="Nazev slozky..."
              className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-transparent focus:border-white/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-transparent hover:bg-white/[0.04]"
            />
            <button
              onClick={() => onAdd(f._tempId)}
              className="p-1 rounded text-slate-300 hover:text-blue-400 hover:bg-blue-500/100/10 transition opacity-0 group-hover:opacity-100"
              title="Pridat podslozku"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onRemove(f._tempId)}
              className="p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-500/100/10 transition opacity-0 group-hover:opacity-100"
              title="Smazat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <EditFolderTree folders={folders} parentTempId={f._tempId} depth={depth + 1} onAdd={onAdd} onRemove={onRemove} onRename={onRename} />
        </div>
      ))}
    </div>
  );
}

function TemplateEditorModal({
  template,
  fieldDefs,
  orgId,
  onClose,
  onSaved,
}: {
  template: Template | null;
  fieldDefs: FieldDef[];
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [defaultStatus, setDefaultStatus] = useState(template?.default_status || 'lead');

  const [milestones, setMilestones] = useState<Omit<TemplateMilestone, 'id' | 'template_id'>[]>(
    template?.milestones.map((m) => ({ name: m.name, offset_days: m.offset_days, duration_days: m.duration_days, color: m.color, sort_order: m.sort_order })) || []
  );

  const [tasks, setTasks] = useState<Omit<TemplateTask, 'id' | 'template_id'>[]>(
    template?.tasks.map((t) => ({ milestone_index: t.milestone_index, title: t.title, description: t.description, priority: t.priority, sort_order: t.sort_order })) || []
  );

  const [editFolders, setEditFolders] = useState<EditFolder[]>(() =>
    template?.folders ? buildEditFolders(template.folders) : []
  );

  const [cfValues, setCfValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    (template?.customFields || []).forEach((cf) => { m[cf.field_id] = cf.default_value; });
    return m;
  });

  const [activeSection, setActiveSection] = useState<'general' | 'milestones' | 'tasks' | 'folders' | 'fields'>('general');

  const addMilestone = () => {
    const lastEnd = milestones.length > 0 ? milestones[milestones.length - 1].offset_days + milestones[milestones.length - 1].duration_days : 0;
    setMilestones((prev) => [...prev, {
      name: '',
      offset_days: lastEnd,
      duration_days: 7,
      color: MILESTONE_COLORS[prev.length % MILESTONE_COLORS.length],
      sort_order: prev.length,
    }]);
  };

  const updateMilestone = (idx: number, updates: Partial<Omit<TemplateMilestone, 'id' | 'template_id'>>) => {
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, ...updates } : m)));
  };

  const removeMilestone = (idx: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
    setTasks((prev) => prev.map((t) => t.milestone_index === idx ? { ...t, milestone_index: -1 } : t));
  };

  const addTask = () => {
    setTasks((prev) => [...prev, { milestone_index: -1, title: '', description: '', priority: 'medium', sort_order: prev.length }]);
  };

  const updateTask = (idx: number, updates: Partial<Omit<TemplateTask, 'id' | 'template_id'>>) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  };

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const addFolder = (parentTempId: string | null) => {
    const siblings = editFolders.filter((f) => f.parentTempId === parentTempId);
    setEditFolders((prev) => [...prev, {
      _tempId: nextFolderId(),
      parentTempId,
      name: '',
      sort_order: siblings.length,
    }]);
  };

  const removeFolder = (tempId: string) => {
    const collectIds = (id: string): string[] => {
      const children = editFolders.filter((f) => f.parentTempId === id);
      return [id, ...children.flatMap((c) => collectIds(c._tempId))];
    };
    const idsToRemove = new Set(collectIds(tempId));
    setEditFolders((prev) => prev.filter((f) => !idsToRemove.has(f._tempId)));
  };

  const renameFolder = (tempId: string, newName: string) => {
    setEditFolders((prev) => prev.map((f) => f._tempId === tempId ? { ...f, name: newName } : f));
  };

  const saveFoldersRecursive = async (templateId: string, parentDbId: string | null, parentTempId: string | null) => {
    const children = editFolders.filter((f) => f.parentTempId === parentTempId && f.name.trim()).sort((a, b) => a.sort_order - b.sort_order);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const { data } = await supabase.from('template_folders')
        .insert({ template_id: templateId, parent_id: parentDbId, name: child.name.trim(), sort_order: i })
        .select('id').maybeSingle();
      if (data) {
        await saveFoldersRecursive(templateId, data.id, child._tempId);
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast('Zadejte název šablony', 'error'); return; }
    setSaving(true);

    let templateId = template?.id;

    if (template) {
      await supabase.from('project_templates').update({
        name: name.trim(), description: description.trim(), default_status: defaultStatus, updated_at: new Date().toISOString(),
      }).eq('id', template.id);

      await supabase.from('template_milestones').delete().eq('template_id', template.id);
      await supabase.from('template_tasks').delete().eq('template_id', template.id);
      await supabase.from('template_custom_fields').delete().eq('template_id', template.id);
      await supabase.from('template_folders').delete().eq('template_id', template.id);
    } else {
      const { data } = await supabase.from('project_templates')
        .insert({ organization_id: orgId, name: name.trim(), description: description.trim(), default_status: defaultStatus })
        .select('id').maybeSingle();
      if (!data) { toast('Chyba při ukládání', 'error'); setSaving(false); return; }
      templateId = data.id;
    }

    if (milestones.length > 0) {
      await supabase.from('template_milestones').insert(
        milestones.filter((m) => m.name.trim()).map((m, i) => ({ template_id: templateId, ...m, sort_order: i }))
      );
    }

    if (tasks.length > 0) {
      await supabase.from('template_tasks').insert(
        tasks.filter((t) => t.title.trim()).map((t, i) => ({ template_id: templateId, ...t, sort_order: i }))
      );
    }

    const cfEntries = Object.entries(cfValues).filter(([_, v]) => v.trim());
    if (cfEntries.length > 0) {
      await supabase.from('template_custom_fields').insert(
        cfEntries.map(([fieldId, val]) => ({ template_id: templateId, field_id: fieldId, default_value: val }))
      );
    }

    if (editFolders.some((f) => f.name.trim())) {
      await saveFoldersRecursive(templateId!, null, null);
    }

    setSaving(false);
    toast(template ? 'Šablona aktualizována' : 'Šablona vytvořena', 'success');
    onSaved();
  };

  const folderCount = editFolders.filter((f) => f.name.trim()).length;

  const sections = [
    { key: 'general' as const, label: 'Obecné' },
    { key: 'milestones' as const, label: `Milníky (${milestones.length})` },
    { key: 'tasks' as const, label: `Úkoly (${tasks.length})` },
    { key: 'folders' as const, label: `Složky (${folderCount})` },
    { key: 'fields' as const, label: 'Pole' },
  ];

  return (
    <Modal open onClose={onClose} title={template ? 'Upravit šablonu' : 'Nová šablona projektu'} size="lg">
      <div className="flex gap-1 mb-5 bg-white/[0.06] rounded-lg p-0.5">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition ${activeSection === s.key ? 'bg-white/[0.06] text-white ' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-[350px] max-h-[60vh] overflow-y-auto">
        {activeSection === 'general' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Název šablony *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Rekonstrukce koupelny" className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Popis</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Krátký popis šablony..." className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Výchozí stav projektu</label>
              <select value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeSection === 'milestones' && (
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <div key={i} className="bg-white/[0.04] rounded-xl p-4 border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  <input value={m.name} onChange={(e) => updateMilestone(i, { name: e.target.value })} placeholder="Název milníku..." className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <button onClick={() => removeMilestone(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/100/10 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Začátek (den)</label>
                    <input type="number" min={0} value={m.offset_days} onChange={(e) => updateMilestone(i, { offset_days: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Trvání (dní)</label>
                    <input type="number" min={1} value={m.duration_days} onChange={(e) => updateMilestone(i, { duration_days: parseInt(e.target.value) || 1 })} className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Barva</label>
                    <div className="flex gap-1 flex-wrap">
                      {MILESTONE_COLORS.map((c) => (
                        <button key={c} onClick={() => updateMilestone(i, { color: c })} className={`w-6 h-6 rounded-full transition ${m.color === c ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addMilestone} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-white/10 rounded-xl text-sm font-bold text-slate-400 hover:border-white/[0.12] hover:text-slate-400 transition">
              <Plus className="w-4 h-4" /> Přidat milník
            </button>
          </div>
        )}

        {activeSection === 'tasks' && (
          <div className="space-y-3">
            {tasks.map((t, i) => (
              <div key={i} className="bg-white/[0.04] rounded-xl p-4 border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <input value={t.title} onChange={(e) => updateTask(i, { title: e.target.value })} placeholder="Název úkolu..." className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <button onClick={() => removeTask(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/100/10 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Milník</label>
                    <select value={t.milestone_index} onChange={(e) => updateTask(i, { milestone_index: parseInt(e.target.value) })} className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option value={-1}>Bez milníku</option>
                      {milestones.map((m, mi) => <option key={mi} value={mi}>{m.name || `Milník ${mi + 1}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Priorita</label>
                    <select value={t.priority} onChange={(e) => updateTask(i, { priority: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                <input value={t.description} onChange={(e) => updateTask(i, { description: e.target.value })} placeholder="Popis úkolu (volitelné)..." className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            ))}
            <button onClick={addTask} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-white/10 rounded-xl text-sm font-bold text-slate-400 hover:border-white/[0.12] hover:text-slate-400 transition">
              <Plus className="w-4 h-4" /> Přidat úkol
            </button>
          </div>
        )}

        {activeSection === 'folders' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Definujte hierarchii složek, které se automaticky vytvoří v každém novém projektu založeném z této šablony.
            </p>
            {editFolders.length > 0 && (
              <div className="bg-white/[0.04] rounded-xl p-4 border border-white/10">
                <EditFolderTree
                  folders={editFolders}
                  parentTempId={null}
                  depth={0}
                  onAdd={addFolder}
                  onRemove={removeFolder}
                  onRename={renameFolder}
                />
              </div>
            )}
            <button
              onClick={() => addFolder(null)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-white/10 rounded-xl text-sm font-bold text-slate-400 hover:border-white/[0.12] hover:text-slate-400 transition"
            >
              <Plus className="w-4 h-4" /> Přidat složku
            </button>
          </div>
        )}

        {activeSection === 'fields' && (
          <div className="space-y-3">
            {fieldDefs.length === 0 ? (
              <div className="text-center py-10">
                <Settings2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nejsou definována žádná vlastní pole. Nejprve je vytvořte v sekci Vlastní pole.</p>
              </div>
            ) : (
              fieldDefs.map((fd) => (
                <div key={fd.id} className="flex items-center gap-4 bg-white/[0.04] rounded-xl px-4 py-3 border border-white/10">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-300">{fd.name}</div>
                    {fd.section && <div className="text-[11px] text-slate-400">{fd.section}</div>}
                  </div>
                  {fd.field_type === 'select' ? (
                    <select
                      value={cfValues[fd.id] || ''}
                      onChange={(e) => setCfValues((prev) => ({ ...prev, [fd.id]: e.target.value }))}
                      className="w-48 px-2 py-1.5 rounded-lg border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">-- bez výchozí --</option>
                      {fd.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : fd.field_type === 'checkbox' ? (
                    <select
                      value={cfValues[fd.id] || ''}
                      onChange={(e) => setCfValues((prev) => ({ ...prev, [fd.id]: e.target.value }))}
                      className="w-48 px-2 py-1.5 rounded-lg border border-white/10 text-sm bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">-- bez výchozí --</option>
                      <option value="true">Ano</option>
                      <option value="false">Ne</option>
                    </select>
                  ) : (
                    <input
                      value={cfValues[fd.id] || ''}
                      onChange={(e) => setCfValues((prev) => ({ ...prev, [fd.id]: e.target.value }))}
                      placeholder="Výchozí hodnota..."
                      className="w-48 px-2 py-1.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/[0.06]">
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/[0.06] rounded-xl transition">Zrušit</button>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
          {saving ? 'Ukládám...' : template ? 'Uložit změny' : 'Vytvořit šablonu'}
        </button>
      </div>
    </Modal>
  );
}
