import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Plus, Trash2, Loader2, FileEdit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { QUOTE_STATUS_LABELS } from '../../lib/configurator/defaults';

interface QuoteRow {
  id: string;
  name: string;
  client: { address?: string };
  totals: { totalWithVat?: number };
  status: string;
  updated_at: string;
}

/** Seznam předběžných nabídek konfigurátoru. */
export default function ConfiguratorListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('preliminary_quotes')
      .select('id, name, client, totals, status, updated_at')
      .order('updated_at', { ascending: false });
    setRows((data ?? []) as QuoteRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row: QuoteRow) => {
    if (!confirm(`Smazat nabídku „${row.name || 'bez názvu'}"?`)) return;
    const { error } = await supabase.from('preliminary_quotes').delete().eq('id', row.id);
    if (error) { toast('Smazání se nepodařilo', 'error'); return; }
    toast('Nabídka smazána');
    load();
  };

  const setStatus = async (row: QuoteRow, status: string) => {
    await supabase.from('preliminary_quotes').update({ status }).eq('id', row.id);
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, status } : r));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Calculator className="w-6 h-6 text-slate-300" />
            <h1 className="text-xl font-bold text-white">Konfigurátor nabídek</h1>
          </div>
          <p className="text-sm text-slate-500">
            Předběžné cenové nabídky technologií — ceník upravíte v Administraci
          </p>
        </div>
        <button
          onClick={() => navigate('/konfigurator/novy')}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> Nová nabídka
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-navy-800/60 rounded-2xl border border-white/10 p-12 text-center">
          <Calculator className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Zatím žádná předběžná nabídka</p>
          <p className="text-xs text-slate-500 mt-1">Vytvořte první tlačítkem Nová nabídka</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const st = QUOTE_STATUS_LABELS[row.status] ?? QUOTE_STATUS_LABELS.draft;
            return (
              <div
                key={row.id}
                className="bg-navy-800/60 backdrop-blur-sm rounded-2xl border border-white/[0.08] hover:border-white/[0.16] transition p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => navigate(`/konfigurator/${row.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{row.name || '(bez názvu)'}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {row.client?.address || '—'}
                    {' · '}upraveno {new Date(row.updated_at).toLocaleDateString('cs-CZ')}
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
