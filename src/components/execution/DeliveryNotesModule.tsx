import { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, Printer, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import { exportDeliveryNotePdf } from './deliveryNotePdfExport';

interface DeliveryNote {
  id: string;
  number: string;
  issue_date: string;
  note: string;
  client_name: string;
  client_address: string;
  status: string;
  created_at: string;
}

interface MaterialRow {
  id: string;
  material_name: string;
  unit: string;
  actual_qty: number;
}

interface NoteItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  sort_order: number;
}

interface Props {
  projectId: string;
  jobId: string;
  onChanged?: () => void;
}

/**
 * Dodací listy k realizaci: hlavička + položky z job_material_entries.
 * Vydáním se materiál označí delivery_note_id, aby se nedostal na dva listy.
 */
export default function DeliveryNotesModule({ projectId, jobId, onChanged }: Props) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [available, setAvailable] = useState<MaterialRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('delivery_notes')
      .select('id, number, issue_date, note, client_name, client_address, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setNotes((data ?? []) as DeliveryNote[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    const { data } = await supabase
      .from('job_material_entries')
      .select('id, material_name, unit, actual_qty')
      .eq('job_id', jobId)
      .gt('actual_qty', 0)
      .is('delivery_note_id', null)
      .order('created_at');
    const rows = (data ?? []) as MaterialRow[];
    setAvailable(rows);
    setSelected(new Set(rows.map((r) => r.id)));
    setNoteText('');
    setShowCreate(true);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) { toast('Vyberte alespoň jednu položku', 'error'); return; }
    setSaving(true);

    // číslo DL-RRRR-NNN (počet za org+rok; jednouživatelský provoz, race přijatelná)
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('delivery_notes')
      .select('id', { count: 'exact', head: true })
      .gte('issue_date', `${year}-01-01`);
    const number = `DL-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`;

    const { data: proj } = await supabase
      .from('projects')
      .select('client_name, address')
      .eq('id', projectId)
      .maybeSingle();

    const { data: dn, error } = await supabase
      .from('delivery_notes')
      .insert({
        project_id: projectId,
        job_id: jobId,
        number,
        issue_date: new Date().toISOString().slice(0, 10),
        note: noteText,
        client_name: (proj as { client_name?: string } | null)?.client_name ?? '',
        client_address: (proj as { address?: string } | null)?.address ?? '',
        status: 'issued',
      })
      .select('id')
      .single();

    if (error || !dn) {
      toast('Dodací list se nepodařilo vytvořit', 'error');
      setSaving(false);
      return;
    }

    const items = available
      .filter((r) => selected.has(r.id))
      .map((r, i) => ({
        delivery_note_id: dn.id,
        material_entry_id: r.id,
        name: r.material_name,
        unit: r.unit,
        quantity: r.actual_qty,
        sort_order: i,
      }));
    const { error: itemsErr } = await supabase.from('delivery_note_items').insert(items);
    if (itemsErr) {
      toast('Položky se nepodařilo uložit', 'error');
      setSaving(false);
      return;
    }

    await supabase
      .from('job_material_entries')
      .update({ delivery_note_id: dn.id })
      .in('id', [...selected]);

    toast(`Dodací list ${number} vydán`);
    setSaving(false);
    setShowCreate(false);
    load();
    onChanged?.();
  };

  const handleDelete = async (note: DeliveryNote) => {
    if (!confirm(`Stornovat dodací list ${note.number}? Materiál se uvolní pro nový dodací list.`)) return;
    // uvolnit material, pak smazat (polozky spadnou pres FK CASCADE)
    await supabase.from('job_material_entries')
      .update({ delivery_note_id: null })
      .eq('delivery_note_id', note.id);
    const { error } = await supabase.from('delivery_notes').delete().eq('id', note.id);
    if (error) {
      toast('Storno se nepodařilo', 'error');
      return;
    }
    toast(`Dodací list ${note.number} stornován`);
    load();
    onChanged?.();
  };

  const handlePrint = async (note: DeliveryNote) => {
    setPrinting(note.id);
    const [itemsRes, companyRes] = await Promise.all([
      supabase.from('delivery_note_items')
        .select('id, name, unit, quantity, sort_order')
        .eq('delivery_note_id', note.id)
        .order('sort_order'),
      supabase.from('company_info')
        .select('company_name, address, city, zip, company_id, tax_id')
        .limit(1)
        .maybeSingle(),
    ]);
    exportDeliveryNotePdf({
      note,
      items: (itemsRes.data ?? []) as NoteItem[],
      company: companyRes.data as {
        company_name: string; address?: string; city?: string; zip?: string;
        company_id?: string; tax_id?: string;
      } | null,
    });
    setPrinting(null);
  };

  return (
    <div className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-4 h-4 text-blue-400" /> Dodací listy
        </h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Nový dodací list
        </button>
      </div>

      <div className="px-5 py-3">
        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
        ) : notes.length === 0 ? (
          <p className="py-4 text-sm text-slate-500 text-center">Zatím žádný dodací list.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {notes.map((n) => (
              <div key={n.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{n.number}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(n.issue_date).toLocaleDateString('cs-CZ')}
                    {n.note ? ` · ${n.note}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handlePrint(n)}
                    disabled={printing === n.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 text-xs font-semibold transition"
                  >
                    {printing === n.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Printer className="w-3.5 h-3.5" />}
                    Tisk
                  </button>
                  <button
                    onClick={() => handleDelete(n)}
                    title="Stornovat dodací list"
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nový dodací list" size="lg">
        <div className="space-y-4">
          {available.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              Žádný nevydaný materiál — vše už je na dodacích listech, nebo zatím nebyla zapsána spotřeba.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Vybráno {selected.size} z {available.length} položek
                </span>
                <button
                  onClick={() => setSelected(selected.size === available.length
                    ? new Set()
                    : new Set(available.map((r) => r.id)))}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  {selected.size === available.length ? 'Zrušit výběr' : 'Vybrat vše'}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                {available.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="accent-blue-500"
                    />
                    <span className="flex-1 text-sm text-slate-200 min-w-0 truncate">{r.material_name}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {r.actual_qty.toLocaleString('cs-CZ')} {r.unit}
                    </span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka</label>
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Např. 1. etapa — rozvody přízemí"
                  className="w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] transition"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || selected.size === 0}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Vydávám…' : 'Vydat dodací list'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
