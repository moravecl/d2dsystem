import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Plus, Trash2, Loader2, FileEdit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { QUOTE_STATUS_LABELS } from '../../lib/configurator/defaults';

interface QuoteRow {
  id: string;
  name: string;
  totals: { totalWithVat?: number; finalPriceAfterSubsidy?: number };
  status: string;
  updated_at: string;
}

interface Props {
  projectId: string;
}

/**
 * Předběžné nabídky konfigurátoru patřící k projektu. Nová nabídka se
 * otevře s předvyplněným klientem a adresou z projektu.
 */
export default function ProjectConfiguratorTab({ projectId }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('preliminary_quotes')
      .select('id, name, totals, status, updated_at')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });
    setRows((data ?? []) as QuoteRow[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row: QuoteRow) => {
    if (!confirm(`Smazat předběžnou nabídku „${row.name || 'bez názvu'}"?`)) return;
    const { error } = await supabase.from('preliminary_quotes').delete().eq('id', row.id);
    if (error) { toast('Smazání se nepodařilo', 'error'); return; }
    toast('Nabídka smazána');
    load();
  };

  const setStatus = async (row: QuoteRow, status: string) => {
    await supabase.from('preliminary_quotes').update({ status }).eq('id', row.id);
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status } : r));
  };

  if (loading) {
    return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Calculator className="w-5 h-5 text-slate-400" />
          <h3 className="text-base font-bold text-white">Předběžné nabídky</h3>
          <span className="text-xs font-bold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full">{rows.length}</span>
        </div>
        <button
          onClick={() => navigate(`/konfigurator/novy?project=${projectId}`)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> Nová předběžná nabídka
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] rounded-2xl border border-white/[0.08]">
          <Calculator className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-400">Zatím žádná předběžná nabídka</p>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurátor sestaví orientační cenu technologií — klient a adresa se předvyplní z projektu
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const st = QUOTE_STATUS_LABELS[row.status] ?? QUOTE_STATUS_LABELS.draft;
            return (
              <div
                key={row.id}
                className="flex items-center gap-4 p-3.5 bg-white/[0.06] rounded-xl border border-white/[0.08] hover:border-white/[0.12] transition cursor-pointer"
                onClick={() => navigate(`/konfigurator/${row.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{row.name || '(bez názvu)'}</div>
                  <div className="text-xs text-slate-500">
                    upraveno {new Date(row.updated_at).toLocaleDateString('cs-CZ')}
                  </div>
                </div>
                <div className="text-sm font-bold text-white shrink-0">
                  {row.totals?.totalWithVat
                    ? `${Math.round(row.totals.totalWithVat).toLocaleString('cs-CZ')} Kč`
                    : '—'}
                </div>
                <select
                  value={row.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setStatus(row, e.target.value)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg outline-none border border-white/10 bg-navy-800 shrink-0 ${st.color}`}
                >
                  {Object.entries(QUOTE_STATUS_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/konfigurator/${row.id}`); }}
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition shrink-0"
                  title="Upravit"
                >
                  <FileEdit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                  title="Smazat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
