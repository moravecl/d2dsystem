import { useState, useEffect } from 'react';
import { Loader2, Save, RefreshCw, Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import type { QuoteSection, QuoteSourceMeta, QuoteAttachment, QuoteSystemSummary } from './quoteHelpers';
import { saveQuoteDirectly } from '../../lib/quoteDirectSave';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  sections: QuoteSection[];
  globalDiscount?: number;
  sourceType?: QuoteSourceMeta['sourceType'];
  sourceMeta?: QuoteSourceMeta;
  attachments?: QuoteAttachment[];
  summaries?: QuoteSystemSummary[];
  onSaved?: () => void;
}

export default function SaveQuoteModal({
  open, onClose, projectId, sections, globalDiscount = 0,
  sourceType = 'manual', sourceMeta, attachments, summaries, onSaved,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [existingQuote, setExistingQuote] = useState<{ id: string; version: number } | null>(null);

  useEffect(() => {
    if (!open || !projectId) {
      setExistingQuote(null);
      setSaveMode('new');
      return;
    }

    (async () => {
      let query = supabase
        .from('project_quotes')
        .select('id, version')
        .eq('project_id', projectId);

      if (sourceType && sourceType !== 'manual') {
        query = query.eq('source_type', sourceType);
      } else {
        query = query.or('source_type.is.null,source_type.eq.manual');
      }

      const { data } = await query
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setExistingQuote({ id: data.id, version: data.version });
        setSaveMode('overwrite');
      } else {
        setExistingQuote(null);
        setSaveMode('new');
      }
    })();
  }, [open, projectId, sourceType]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveQuoteDirectly({
      projectId,
      userId: user?.id ?? null,
      sections,
      globalDiscount,
      note,
      sourceType,
      sourceMeta,
      attachments,
      summaries,
      overwriteQuoteId: saveMode === 'overwrite' && existingQuote ? existingQuote.id : null,
    });
    setSaving(false);

    if (error) {
      toast(error, 'error');
      return;
    }

    toast(saveMode === 'overwrite' ? 'Nabídka aktualizována' : 'Nabídka uložena jako nová verze');
    setNote('');
    onSaved?.();
    onClose();
  };

  const isOverwrite = saveMode === 'overwrite' && existingQuote;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Uložit nabídku"
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 ${
              isOverwrite ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isOverwrite
                ? <RefreshCw className="w-4 h-4" />
                : <Save className="w-4 h-4" />}
            {saving
              ? 'Ukládám...'
              : isOverwrite
                ? 'Přepsat verzi'
                : 'Uložit jako novou verzi'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {existingQuote && (
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">Způsob uložení</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSaveMode('overwrite')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  saveMode === 'overwrite'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5 mx-auto mb-1" />
                Přepsat v{existingQuote.version}
              </button>
              <button
                onClick={() => setSaveMode('new')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  saveMode === 'new'
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                    : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
                }`}
              >
                <Plus className="w-3.5 h-3.5 mx-auto mb-1" />
                Nová verze
              </button>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">Poznámka (nepovinné)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Např. první nabídka, verze po úpravě..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm bg-white/[0.06] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
          />
        </div>
        <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Přehled</div>
          <div className="text-xs text-slate-300">
            {sections.length} {sections.length === 1 ? 'sekce' : 'sekcí'},{' '}
            {sections.reduce((s, sec) => s + sec.items.length, 0)} položek
          </div>
        </div>
      </div>
    </Modal>
  );
}
