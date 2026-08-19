import { useState, type ReactNode } from 'react';
import { History, RotateCcw, X, Save, Loader2, ChevronDown, AlertTriangle } from 'lucide-react';

export interface VersionItem {
  id: string;
  version_number: number;
  note?: string;
  label?: string;
  description?: string;
  created_at: string;
}

interface Props<V extends VersionItem> {
  open: boolean;
  onClose: () => void;
  versions: V[];
  loading: boolean;
  onSaveVersion: (note: string) => Promise<void>;
  onRestore: (version: V) => void;
  saving?: boolean;
  renderSummary?: (version: V) => ReactNode;
  title?: string;
}

export default function VersionHistoryDrawer<V extends VersionItem>({
  open,
  onClose,
  versions,
  loading,
  onSaveVersion,
  onRestore,
  saving,
  renderSummary,
  title = 'Historie verzí',
}: Props<V>) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<V | null>(null);

  const handleSave = async () => {
    if (!note.trim()) return;
    setIsSaving(true);
    await onSaveVersion(note.trim());
    setNote('');
    setShowSaveForm(false);
    setIsSaving(false);
  };

  const handleRestore = (version: V) => {
    setConfirmRestore(version);
  };

  const doRestore = () => {
    if (!confirmRestore) return;
    onRestore(confirmRestore);
    setConfirmRestore(null);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[380px] max-w-[90vw] bg-navy-800/95 backdrop-blur-xl shadow-2xl z-50 flex flex-col border-l border-white/10 animate-in slide-in-from-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-slate-400" />
            <h2 className="text-sm font-extrabold text-white">{title}</h2>
            <span className="text-[10px] font-extrabold bg-white/[0.06] text-slate-500 px-1.5 py-0.5 rounded-full">
              {versions.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/[0.06] shrink-0">
          {!showSaveForm ? (
            <button
              onClick={() => setShowSaveForm(true)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-extrabold text-xs hover:bg-blue-700 transition w-full justify-center disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> Uložit aktuální stav jako verzi
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-300">Poznámka k verzi</span>
                <button onClick={() => { setShowSaveForm(false); setNote(''); }} className="p-1 text-slate-400 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                className="w-full border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 bg-white/[0.06] resize-none"
                rows={2}
                placeholder="Popis verze (např. 'Varianta A s 8 kamerami')..."
                value={note}
                onChange={e => setNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!note.trim() || isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-extrabold text-xs hover:bg-blue-700 transition w-full justify-center disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Uložit verzi
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          )}
          {!loading && versions.length === 0 && (
            <div className="py-10 text-center px-5">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.06] mx-auto flex items-center justify-center mb-3">
                <History className="w-6 h-6 text-slate-300" />
              </div>
              <div className="text-sm font-extrabold text-slate-400">Zatím žádné verze</div>
              <div className="text-xs text-slate-400 mt-1">Uložte první verzi, abyste mohli sledovat změny.</div>
            </div>
          )}
          {!loading && versions.map(v => (
            <div key={v.id} className="flex items-start gap-3 px-5 py-3.5 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04] transition group">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 text-[11px] font-extrabold text-slate-500 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition">
                v{v.version_number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-white truncate">
                  {v.note || v.label || 'Bez poznámky'}
                </div>
                {v.description && (
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{v.description}</div>
                )}
                {renderSummary && (
                  <div className="mt-1">{renderSummary(v)}</div>
                )}
                <div className="text-[10px] font-extrabold text-slate-400 mt-1">
                  {new Date(v.created_at).toLocaleString('cs-CZ')}
                </div>
              </div>
              <button
                onClick={() => handleRestore(v)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition shrink-0 opacity-0 group-hover:opacity-100"
              >
                <RotateCcw className="w-3 h-3" /> Obnovit
              </button>
            </div>
          ))}
        </div>
      </div>

      {confirmRestore && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-navy-800/60 rounded-2xl shadow-2xl border border-white/10 w-[400px] max-w-[90vw] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Obnovit verzi v{confirmRestore.version_number}?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Aktuální stav bude přepsán. Doporučujeme nejprve uložit aktuální stav jako novou verzi.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 text-xs font-extrabold text-slate-400 bg-white/[0.06] rounded-xl hover:bg-white/[0.08] transition"
              >
                Zrušit
              </button>
              <button
                onClick={doRestore}
                className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Obnovit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
