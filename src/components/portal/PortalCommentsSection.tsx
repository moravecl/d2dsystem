import { useState, useEffect, useCallback } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface Comment {
  id: string;
  project_id: string;
  quote_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
}

export default function PortalCommentsSection({ projectId, quoteId, userId }: {
  projectId: string;
  quoteId?: string | null;
  userId: string;
}) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    let query = supabase.from('portal_comments').select('*').eq('project_id', projectId);
    if (quoteId) query = query.eq('quote_id', quoteId);
    const { data } = await query.order('created_at', { ascending: true });
    setComments((data || []) as Comment[]);
    setLoading(false);
  }, [projectId, quoteId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('portal_comments').insert({
      project_id: projectId,
      quote_id: quoteId || null,
      user_id: userId,
      content: text.trim(),
    });
    setSending(false);
    if (error) { toast('Chyba', 'error'); return; }
    setText('');
    load();
  };

  if (loading) return <div className="animate-pulse h-16 bg-white/[0.06] rounded-lg" />;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Komentáře ({comments.length})
      </h4>

      {comments.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className={`p-3 rounded-lg ${c.user_id === userId ? 'bg-blue-500/10 border border-blue-500/20 ml-8' : 'bg-white/[0.04] border border-white/[0.06] mr-8'}`}>
              <p className="text-sm text-slate-300">{c.content}</p>
              <div className="text-[10px] text-slate-400 mt-1">
                {new Date(c.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Napište komentář..."
          className="flex-1 px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <button onClick={handleSend} disabled={!text.trim() || sending} className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
