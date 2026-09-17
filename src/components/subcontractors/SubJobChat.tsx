import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  is_from_sub: boolean;
  message: string;
  created_at: string;
}

interface Props {
  jobSubId: string;
  viewer: 'org' | 'sub';
  /** Jméno protistrany do hlaviček bublin (org vidí subku, subka objednatele). */
  counterpartyName?: string;
  canWrite?: boolean;
}

/** Chat mezi objednatelem a subdodavatelem k jedné zakázce (sub_job_messages). */
export default function SubJobChat({ jobSubId, viewer, counterpartyName, canWrite = true }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);

  const load = useCallback(async () => {
    const { data } = await supabase.from('sub_job_messages')
      .select('id, is_from_sub, message, created_at')
      .eq('job_subcontractor_id', jobSubId)
      .order('created_at', { ascending: true });
    const rows = (data || []) as Message[];
    setMessages(rows);
    setLoading(false);
    if (rows.length !== countRef.current) {
      countRef.current = rows.length;
      setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'nearest' }), 50);
    }
  }, [jobSubId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const { data: session } = await supabase.auth.getSession();
    const { error } = await supabase.from('sub_job_messages').insert({
      job_subcontractor_id: jobSubId,
      is_from_sub: viewer === 'sub',
      created_by: session.session?.user.id,
      message: text.trim(),
    });
    setSending(false);
    if (error) return;
    setText('');
    load();
  };

  const isMine = (m: Message) => (viewer === 'sub') === m.is_from_sub;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-400" /> Komunikace
      </h3>
      {loading ? (
        <div className="animate-pulse h-14 bg-white/[0.06] rounded-lg" />
      ) : messages.length === 0 ? (
        <p className="text-xs text-slate-500">Zatím žádné zprávy. Napište první.</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {messages.map(m => (
            <div key={m.id} className={`p-3 rounded-xl ${isMine(m)
              ? 'bg-blue-500/10 border border-blue-500/20 ml-8'
              : 'bg-white/[0.04] border border-white/[0.06] mr-8'}`}
            >
              <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{m.message}</p>
              <div className="text-[10px] text-slate-500 mt-1">
                {isMine(m) ? 'Vy' : (counterpartyName || (m.is_from_sub ? 'Subdodavatel' : 'Objednatel'))}
                {' · '}
                {new Date(m.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      {canWrite && (
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Napište zprávu…"
            className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
