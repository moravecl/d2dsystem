import { useEffect, useState } from 'react';
import { X, Trash2, FolderOpen, Clock, CheckCircle2, Send, FileEdit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import type { Project } from '../../types/database';
import type { SelectionState, ProjectMeta, Placement, Floor } from '../../hooks/useProjectState';

function pinToPlacement(pin: { id: string; x: number; y: number; note: string; placed_at: string; design_config: Record<string, unknown> | null }): Placement {
  const dc = (pin.design_config ?? {}) as Record<string, unknown>;
  const { floorId, icon, room, circuitId, mountingHeight, frameSize, modules, colorName, colorHex } = dc;
  const placement: Placement = {
    id: pin.id,
    x: Number(pin.x),
    y: Number(pin.y),
    note: pin.note,
    ts: new Date(pin.placed_at).getTime(),
    floorId: (floorId as string) || 'floor-1',
  };
  if (frameSize !== undefined) {
    placement.config = { frameSize: frameSize as number, modules: modules as string[], colorName: colorName as string | undefined, colorHex: colorHex as string | undefined };
  } else if (colorName) {
    placement.colorName = colorName as string;
    if (colorHex) placement.colorHex = colorHex as string;
  }
  if (icon) placement.icon = icon as string;
  if (room) placement.room = room as string;
  if (circuitId) placement.circuitId = circuitId as string;
  if (mountingHeight) placement.mountingHeight = mountingHeight as string;
  return placement;
}

const STATUSES = [
  { value: 'draft', label: 'Koncept', icon: FileEdit },
  { value: 'in_progress', label: 'Rozpracovaný', icon: Clock },
  { value: 'completed', label: 'Dokončený', icon: CheckCircle2 },
  { value: 'sent', label: 'Odesláný', icon: Send },
];

interface SaveModalProps {
  open: boolean;
  onClose: () => void;
  meta: ProjectMeta;
  selected: SelectionState;
  floors: Floor[];
}

export function SaveModal({ open, onClose, meta, selected, floors }: SaveModalProps) {
  const [name, setName] = useState(meta.version || '');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setName(meta.version || '');
    setDescription('');
    setStatus('draft');
  }, [meta.version, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) { toast('Vyplňte název', 'error'); return; }
    if (!user) { toast('Nejste přihlášeni', 'error'); return; }
    setSaving(true);

    let quoteData = null;
    try {
      const raw = localStorage.getItem('hs-quote-data');
      if (raw) quoteData = JSON.parse(raw);
    } catch { /* ignore */ }

    const { data: project, error: projErr } = await supabase.from('projects').insert({
      user_id: user.id,
      name: name.trim(),
      project_name: meta.project,
      client_name: meta.client,
      version_label: meta.version,
      floorplan_url: JSON.stringify(floors),
      selection_data: selected,
      status,
      description: description.trim(),
      quote_data: quoteData,
    }).select().maybeSingle();

    if (projErr || !project) {
      toast(projErr?.message || 'Chyba při ukládání', 'error');
      setSaving(false);
      return;
    }

    const productIds = Object.keys(selected);
    if (productIds.length > 0) {
      const selections = productIds.map((pid) => ({ project_id: project.id, product_id: pid }));
      await supabase.from('project_selections').insert(selections);

      const placements = [];
      for (const pid of productIds) {
        for (const pl of selected[pid].placements) {
          const dc: Record<string, unknown> = { ...(pl.config as Record<string, unknown> || {}), floorId: pl.floorId };
          if (pl.icon) dc.icon = pl.icon;
          if (pl.room) dc.room = pl.room;
          if (pl.circuitId) dc.circuitId = pl.circuitId;
          if (pl.mountingHeight) dc.mountingHeight = pl.mountingHeight;
          placements.push({
            project_id: project.id,
            product_id: pid,
            x: pl.x,
            y: pl.y,
            note: pl.note,
            design_config: dc,
            placed_at: new Date(pl.ts).toISOString(),
          });
        }
      }
      if (placements.length > 0) {
        await supabase.from('pin_placements').insert(placements);
      }
    }

    setSaving(false);
    toast('Projekt uložen');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-backdrop-enter">
      <div className="bg-navy-800/60 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-modal-enter">
        <div className="p-5 border-b bg-white/[0.04] flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-white">Uložit verzi</h3>
          <button onClick={onClose} className="bg-white/[0.06] p-2 rounded-full border  text-slate-400 hover:text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Název verze</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-extrabold focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              placeholder="např. V1 - 24V premium" />
          </div>
          <div>
            <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">Popis / poznámky</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/20 resize-none text-sm"
              placeholder="Co se změnilo v této verzi..." />
          </div>
          <div>
            <label className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-2">Stav</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatus(s.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition text-sm font-extrabold ${
                      status === s.value
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-white/[0.06] bg-white/[0.06] text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-extrabold hover:bg-blue-700 transition shadow-lg disabled:opacity-60">
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface LoadModalProps {
  open: boolean;
  onClose: () => void;
  onLoad: (selected: SelectionState, meta: ProjectMeta, floorsOrFp: Floor[] | string | null) => void;
}

export function LoadModal({ open, onClose, onLoad }: LoadModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadList = async () => {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadList();
  }, [open]);

  if (!open) return null;

  const handleLoad = async (proj: Project) => {
    const [{ data: sels }, { data: pins }] = await Promise.all([
      supabase.from('project_selections').select('*').eq('project_id', proj.id),
      supabase.from('pin_placements').select('*').eq('project_id', proj.id).order('placed_at'),
    ]);

    const selected: SelectionState = {};
    for (const sel of sels ?? []) {
      selected[sel.product_id] = { placements: [] };
    }
    for (const pin of pins ?? []) {
      if (!selected[pin.product_id]) selected[pin.product_id] = { placements: [] };
      const placement = pinToPlacement(pin);
      selected[pin.product_id].placements.push(placement);
    }

    let floorsOrFp: Floor[] | string | null = null;
    try {
      const parsed = JSON.parse(proj.floorplan_url);
      if (Array.isArray(parsed)) floorsOrFp = parsed;
      else floorsOrFp = proj.floorplan_url || null;
    } catch {
      floorsOrFp = proj.floorplan_url || null;
    }

    if (proj.quote_data) {
      try {
        localStorage.setItem('hs-quote-data', JSON.stringify(proj.quote_data));
      } catch { /* ignore */ }
    }

    onLoad(
      selected,
      { project: proj.project_name, client: proj.client_name, version: proj.version_label },
      floorsOrFp,
    );
    toast('Projekt načten');
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat?')) return;
    await supabase.from('projects').delete().eq('id', id);
    toast('Smazáno');
    loadList();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-backdrop-enter">
      <div className="bg-navy-800/60 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-modal-enter">
        <div className="p-5 border-b bg-white/[0.04] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white">Načíst verzi</h3>
            <p className="text-xs text-slate-500">Uloženo v databázi.</p>
          </div>
          <button onClick={onClose} className="bg-white/[0.06] p-2 rounded-full border  text-slate-400 hover:text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Načítám...</div>
          ) : projects.length === 0 ? (
            <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/[0.06] text-center">
              <div className="text-lg font-extrabold text-white">Zatím nic uloženého</div>
              <div className="text-sm text-slate-500 mt-1">Klikni na &quot;Uložit&quot;.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((proj) => {
                const statusCfg = STATUSES.find((s) => s.value === (proj.status || 'draft'));
                const StatusIcon = statusCfg?.icon || FileEdit;
                return (
                  <div key={proj.id} className="p-4 rounded-2xl border border-white/[0.06] hover:border-blue-200 transition bg-white/[0.06]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-base font-extrabold text-white truncate">{proj.name}</div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/[0.06] text-slate-400">
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg?.label || 'Koncept'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(proj.created_at).toLocaleString('cs-CZ')}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Projekt: <b>{proj.project_name || '--'}</b> | Zákazník: <b>{proj.client_name || '--'}</b>
                        </div>
                        {proj.description && (
                          <div className="text-xs text-slate-500 mt-1 italic">{proj.description}</div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleLoad(proj)}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5" /> Načíst
                        </button>
                        <button onClick={() => handleDelete(proj.id)}
                          className="px-3 py-2 rounded-xl bg-navy-800/60 border border-white/[0.08] text-slate-300 font-extrabold hover:bg-white/[0.04] transition">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function loadProjectById(projectId: string): Promise<{
  selected: SelectionState;
  meta: ProjectMeta;
  floorsOrFp: Floor[] | string | null;
} | null> {
  const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (!proj) return null;

  const selected: SelectionState = {};

  if (proj.selection_data && typeof proj.selection_data === 'object' && !Array.isArray(proj.selection_data)) {
    const sd = proj.selection_data as Record<string, { placements: unknown[] }>;
    for (const [pid, entry] of Object.entries(sd)) {
      if (entry && Array.isArray(entry.placements)) {
        selected[pid] = {
          placements: (entry.placements as Record<string, unknown>[]).map((pl) => ({
            id: (pl.id as string) || crypto.randomUUID(),
            x: Number(pl.x ?? 0),
            y: Number(pl.y ?? 0),
            note: (pl.note as string) || '',
            ts: Number(pl.ts ?? Date.now()),
            floorId: (pl.floorId as string) || 'floor-1',
            ...(pl.config ? { config: pl.config as Placement['config'] } : {}),
            ...(pl.colorName ? { colorName: pl.colorName as string } : {}),
            ...(pl.colorHex ? { colorHex: pl.colorHex as string } : {}),
            ...(pl.icon ? { icon: pl.icon as string } : {}),
            ...(pl.room ? { room: pl.room as string } : {}),
            ...(pl.circuitId ? { circuitId: pl.circuitId as string } : {}),
            ...(pl.mountingHeight ? { mountingHeight: pl.mountingHeight as string } : {}),
          })),
        };
      }
    }
  } else {
    const [{ data: sels }, { data: pins }] = await Promise.all([
      supabase.from('project_selections').select('*').eq('project_id', proj.id),
      supabase.from('pin_placements').select('*').eq('project_id', proj.id).order('placed_at'),
    ]);
    for (const sel of sels ?? []) {
      selected[sel.product_id] = { placements: [] };
    }
    for (const pin of pins ?? []) {
      if (!selected[pin.product_id]) selected[pin.product_id] = { placements: [] };
      const placement = pinToPlacement(pin);
      selected[pin.product_id].placements.push(placement);
    }
  }

  let floorsOrFp: Floor[] | string | null = null;
  try {
    const parsed = JSON.parse(proj.floorplan_url);
    if (Array.isArray(parsed)) floorsOrFp = parsed;
    else floorsOrFp = proj.floorplan_url || null;
  } catch {
    floorsOrFp = proj.floorplan_url || null;
  }

  if (proj.quote_data) {
    try {
      localStorage.setItem('hs-quote-data', JSON.stringify(proj.quote_data));
    } catch { /* ignore */ }
  }

  return {
    selected,
    meta: { project: proj.project_name, client: proj.client_name, version: proj.version_label },
    floorsOrFp,
  };
}
