import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile_name?: string;
}

export default function QuoteCommentsPanel({ quoteId }: { quoteId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('quote_comments')
      .select('id, user_id, content, created_at')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    const list = (data || []) as Comment[];
    const userIds = [...new Set(list.map(c => c.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds);
      const map = new Map((profiles || []).map((p: any) => [p.id, p.display_name || p.email]));
      list.forEach(c => { c.profile_name = map.get(c.user_id) || ''; });
    }
    setComments(list);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [quoteId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('quote_comments').insert({
      quote_id: quoteId,
      user_id: user.id,
      content: text.trim(),
    });
    if (error) {
      toast('Chyba', 'error');
    } else {
      setText('');
      load();
    }
    setSending(false);
  };

  if (loading) return <div className="h-20 bg-white/[0.06] rounded-lg animate-pulse" />;

  return (
    <div className="border-t border-white/[0.06]">
      <div className="max-h-64 overflow-y-auto p-3 space-y-2">
        {comments.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">{`Žádné komentáře`}</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={`flex ${c.user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
 c.user_id === user?.id
 ? 'bg-blue-600 text-white'
 : 'bg-white/[0.06] text-white'
 }`}>
                <p className="text-[10px] font-semibold mb-0.5 opacity-70">{c.profile_name}</p>
                <p className="text-xs">{c.content}</p>
                <p className="text-[9px] opacity-50 mt-0.5">
                  {new Date(c.created_at).toLocaleString('cs-CZ')}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Napsat komentář\u2026`}
          className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
