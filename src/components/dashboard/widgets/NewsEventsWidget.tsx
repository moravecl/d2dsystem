import { Link } from 'react-router-dom';
import { Newspaper, CalendarDays, ArrowRight, MapPin, Pin, MessageCircle } from 'lucide-react';
import type { DashboardData } from '../dashboardTypes';

interface Props {
  data: DashboardData;
  editMode: boolean;
}

export default function NewsEventsWidget({ data, editMode }: Props) {
  const { newsPosts, newsCommentCounts, upcomingEvents, profiles } = data;
  if (newsPosts.length === 0 && upcomingEvents.length === 0) return null;

  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const catColors: Record<string, string> = {
    novinka: 'bg-blue-500/20 text-blue-300',
    oznameni: 'bg-amber-500/20 text-amber-300',
    tip: 'bg-emerald-500/20 text-emerald-300',
    dulezite: 'bg-red-500/20 text-red-300',
  };
  const catLabels: Record<string, string> = {
    novinka: 'Novinka',
    oznameni: 'Oznámení',
    tip: 'Tip',
    dulezite: 'Důležité',
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950 rounded-2xl p-1' : ''}`}>
      <div className="lg:col-span-2 glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-blue-400" />Nástěnka
          </h2>
          <Link to="/nastenka" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 group transition-colors">
            Vse <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        {newsPosts.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Žádné příspěvky</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {newsPosts.map(post => (
              <Link key={post.id} to="/nastenka" className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition-colors group">
                {post.image_url ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 mt-0.5">
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow shadow-blue-500/20">
                    {(getProfileName(post.author_id) || 'N')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.is_pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                    <span className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{post.title}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${catColors[post.category] || catColors.novinka}`}>
                      {catLabels[post.category] || 'Novinka'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{post.content}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                    <span>{getProfileName(post.author_id)}</span>
                    <span>{new Date(post.created_at).toLocaleDateString('cs-CZ')}</span>
                    {(newsCommentCounts[post.id] || 0) > 0 && (
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {newsCommentCounts[post.id]}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-rose-400" />Události
          </h2>
          <Link to="/udalosti" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 group transition-colors">
            Vse <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Žádné nadcházející události</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {upcomingEvents.map(ev => {
              const isToday = ev.start_date === new Date().toISOString().split('T')[0];
              return (
                <Link key={ev.id} to="/udalosti" className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors group">
                  <div className={`w-11 text-center shrink-0 rounded-lg p-1.5 ${isToday ? 'bg-blue-500/15 border border-blue-500/25' : 'bg-white/[0.05]'}`}>
                    <div className={`text-[10px] font-bold uppercase ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                      {new Date(ev.start_date + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
                    </div>
                    {!ev.all_day && ev.start_time && (
                      <div className="text-[10px] text-slate-500 font-medium">{ev.start_time.slice(0, 5)}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{ev.title}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                      {ev.event_type_name && (
                        <span className={`font-bold px-1.5 py-0.5 rounded-full ${ev.event_type_color}`}>{ev.event_type_name}</span>
                      )}
                      {ev.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {ev.location}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
