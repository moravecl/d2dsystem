import { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { Save, Clock, Pencil, Copy, List, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import RichTextEditor from '../admin/RichTextEditor';

interface MinutesData {
  id?: string;
  content: string;
  decisions: string;
  notes: string;
  duration_minutes: number;
  created_by: string | null;
  updated_at: string;
}

interface AgendaItem {
  id: string;
  title: string;
  description: string;
  status: string;
  sort_order: number;
}

interface ProfileRef { id: string; display_name: string | null; email: string; }

interface Props {
  meetingId: string;
  meetingStatus: string;
  startTime: string | null;
  endTime: string | null;
  profiles: ProfileRef[];
}

export default function MeetingMinutesTab({ meetingId, meetingStatus, startTime, endTime, profiles }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<MinutesData>({ content: '', decisions: '', notes: '', duration_minutes: 0, created_by: null, updated_at: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    (async () => {
      const [minutesRes, agendaRes] = await Promise.all([
        supabase.from('meeting_minutes').select('*').eq('meeting_id', meetingId).maybeSingle(),
        supabase.from('meeting_agenda_items').select('id, title, description, status, sort_order').eq('meeting_id', meetingId).order('sort_order'),
      ]);

      setAgendaItems((agendaRes.data || []) as AgendaItem[]);

      if (minutesRes.data) {
        setData(minutesRes.data as MinutesData);
        setHasRecord(true);
        setEditing(false);
      } else {
        setEditing(true);
      }
      setLoading(false);
    })();
  }, [meetingId]);

  const computedDuration = (() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  })();

  const getName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const handleCopyAgenda = () => {
    if (agendaItems.length === 0) {
      toast('Agenda je prázdná', 'error');
      return;
    }

    const agendaHtml = agendaItems.map((item, idx) => {
      let html = `<p><strong>${idx + 1}. ${item.title}</strong></p>`;
      if (item.description) {
        html += `<p><em>${item.description}</em></p>`;
      }
      html += `<p>Zápis:&nbsp;</p>`;
      return html;
    }).join('');

    setData(prev => ({
      ...prev,
      content: prev.content ? prev.content + agendaHtml : agendaHtml,
    }));

    toast('Agenda vložena do zápisu');
  };

  const performSave = useCallback(async (dataToSave: MinutesData, isAutoSave = false) => {
    if (!user) return false;

    const payload = {
      meeting_id: meetingId,
      content: dataToSave.content,
      decisions: dataToSave.decisions,
      notes: dataToSave.notes,
      duration_minutes: dataToSave.duration_minutes || computedDuration,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (hasRecord && dataToSave.id) {
      const { error } = await supabase.from('meeting_minutes').update(payload).eq('id', dataToSave.id);
      if (error) {
        if (!isAutoSave) toast('Chyba při ukládání', 'error');
        return false;
      }
    } else {
      const { data: created, error } = await supabase.from('meeting_minutes').insert(payload).select().maybeSingle();
      if (error) {
        if (!isAutoSave) toast('Chyba při ukládání', 'error');
        return false;
      }
      if (created) {
        setData(created as MinutesData);
        setHasRecord(true);
      }
    }
    return true;
  }, [user, meetingId, computedDuration, hasRecord, toast]);

  const triggerAutoSave = useCallback((newData: MinutesData) => {
    const dataHash = JSON.stringify({ content: newData.content, decisions: newData.decisions, notes: newData.notes });
    if (dataHash === lastSavedRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      const success = await performSave(newData, true);
      if (success) {
        lastSavedRef.current = dataHash;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } else {
        setAutoSaveStatus('idle');
      }
    }, 2000);
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleDataChange = useCallback((field: keyof MinutesData, value: string | number) => {
    setData(prev => {
      const newData = { ...prev, [field]: value };
      triggerAutoSave(newData);
      return newData;
    });
  }, [triggerAutoSave]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const success = await performSave(data, false);

    setSaving(false);
    if (success) {
      lastSavedRef.current = JSON.stringify({ content: data.content, decisions: data.decisions, notes: data.notes });
      setEditing(false);
      toast('Zápis uložen');
    }
  };

  if (loading) {
    return <div className="h-48 bg-white/[0.04] rounded-xl animate-pulse" />;
  }

  const isCompleted = meetingStatus === 'completed';
  const showReadonly = isCompleted && hasRecord && !editing;

  return (
    <div className="space-y-5">
      {showReadonly ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-300">Zápis z porady</h3>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 rounded-lg transition">
              <Pencil className="w-3.5 h-3.5" /> Upravit
            </button>
          </div>

          {data.content && (
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Průběh jednání</h4>
              <div className="text-sm text-slate-300 prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content) }} />
            </div>
          )}

          {data.decisions && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">Klíčová rozhodnutí</h4>
              <div className="text-sm text-slate-300 prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.decisions) }} />
            </div>
          )}

          {data.notes && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <h4 className="text-xs font-bold text-amber-400 uppercase mb-2">Doplňkové poznámky</h4>
              <div className="text-sm text-slate-300 prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.notes) }} />
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-400">
            {data.duration_minutes > 0 && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {data.duration_minutes} min</span>
            )}
            {data.created_by && <span>Zapsal: {getName(data.created_by)}</span>}
            {data.updated_at && <span>Poslední úprava: {new Date(data.updated_at).toLocaleString('cs-CZ')}</span>}
          </div>
        </>
      ) : (
        <>
          {agendaItems.length > 0 && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <List className="w-4 h-4" />
                  Agenda k projednání ({agendaItems.length} bodů)
                </div>
                <button
                  onClick={handleCopyAgenda}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Vložit do zápisu
                </button>
              </div>
              <div className="space-y-2">
                {agendaItems.map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-400 font-semibold w-5 shrink-0">{idx + 1}.</span>
                    <div className="min-w-0">
                      <span className="text-slate-300">{item.title}</span>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-400">Průběh jednání</label>
              {autoSaveStatus !== 'idle' && (
                <div className="flex items-center gap-1.5 text-xs">
                  {autoSaveStatus === 'saving' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                      <span className="text-slate-500">Ukládám...</span>
                    </>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Automaticky uloženo</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <RichTextEditor
              value={data.content}
              onChange={(html) => handleDataChange('content', html)}
              minHeight="200px"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Klíčová rozhodnutí</label>
            <RichTextEditor
              value={data.decisions}
              onChange={(html) => handleDataChange('decisions', html)}
              minHeight="120px"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Doplňkové poznámky</label>
            <RichTextEditor
              value={data.notes}
              onChange={(html) => handleDataChange('notes', html)}
              minHeight="100px"
            />
          </div>

          {computedDuration > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" /> Doba trvání: <span className="font-semibold">{computedDuration} min</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Ukládám...' : 'Uložit zápis'}
            </button>
            {isCompleted && hasRecord && (
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] rounded-xl transition">
                Zrušit
              </button>
            )}
            <span className="text-xs text-slate-500">Zápis se automaticky ukládá</span>
          </div>
        </>
      )}
    </div>
  );
}
