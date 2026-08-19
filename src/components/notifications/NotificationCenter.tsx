import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, Ticket } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-300',
  warning: 'bg-amber-500/20 text-amber-300',
  success: 'bg-emerald-500/20 text-emerald-300',
  error: 'bg-red-500/20 text-red-300',
  task: 'bg-blue-500/20 text-blue-300',
  deadline: 'bg-red-500/20 text-red-300',
  comment: 'bg-cyan-500/20 text-cyan-300',
  service_ticket: 'bg-cyan-500/20 text-cyan-300',
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    const interval = setInterval(loadNotifications, 60000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function loadNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data || []) as Notification[]);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getLink = (n: Notification): string | null => {
    if (!n.entity_type || !n.entity_id) return null;
    switch (n.entity_type) {
      case 'project': return `/projekty/${n.entity_id}`;
      case 'task': return '/ukoly';
      case 'client': return `/crm/${n.entity_id}`;
      case 'asset': return `/majetek/${n.entity_id}`;
      case 'invoice': return '/finance';
      case 'service_ticket': return '/servis?tab=tickets';
      default: return null;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Právě teď';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center min-w-[18px] px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-navy-800/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl shadow-black/50 z-50 overflow-hidden animate-dropdown-enter">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <h3 className="text-sm font-bold text-white">Oznámení</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-500/10 transition">
                  <CheckCheck className="w-3 h-3" /> Přečíst vše
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.06]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Žádná oznámení</p>
              </div>
            ) : (
              notifications.map(n => {
                const link = getLink(n);
                const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.info;

                const content = (
                  <div className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition group ${!n.is_read ? 'bg-blue-500/[0.06]' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                      {n.type === 'service_ticket' ? <Ticket className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{n.title}</span>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">{timeAgo(n.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      {!n.is_read && (
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }} className="p-1 rounded hover:bg-blue-500/20 text-slate-500 hover:text-blue-300 transition" title="Označit jako přečtené">
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotification(n.id); }} className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition" title="Smazat">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );

                return link ? (
                  <Link key={n.id} to={link} onClick={() => { markRead(n.id); setOpen(false); }} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => markRead(n.id)} className="cursor-pointer">
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
