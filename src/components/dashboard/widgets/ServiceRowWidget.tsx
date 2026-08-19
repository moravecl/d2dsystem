import { Link } from 'react-router-dom';
import { Wrench, Shield, AlertCircle, Zap, ArrowRight, Calendar, User } from 'lucide-react';
import type { DashboardData } from '../dashboardTypes';

interface Props {
  data: DashboardData;
  editMode: boolean;
}

export default function ServiceRowWidget({ data, editMode }: Props) {
  const { serviceAlerts, warrantyAlerts, openTicketsCount, quickJobPoolCount, quickJobAlerts } = data;
  const hasContent = serviceAlerts.length > 0 || openTicketsCount > 0 || warrantyAlerts.length > 0 || quickJobPoolCount > 0 || quickJobAlerts.length > 0;
  if (!hasContent) return null;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950 rounded-2xl p-1' : ''}`}>
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-400" />Servisy
          </h3>
          <Link to="/servis" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 group transition-colors">
            Detail <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        {serviceAlerts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Žádné naplánované servisy</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {serviceAlerts.slice(0, 5).map(s => {
              const overdue = new Date(s.next_date) < new Date();
              return (
                <Link key={s.id} to={`/projekty/${s.project_id}?tab=service`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${overdue ? 'bg-red-500/15' : 'bg-blue-500/15'}`}>
                    <Calendar className={`w-4 h-4 ${overdue ? 'text-red-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{s.type_name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{s.project_name}</div>
                  </div>
                  <div className={`text-[10px] font-bold shrink-0 ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                    {new Date(s.next_date).toLocaleDateString('cs-CZ')}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />Záruky
          </h3>
        </div>
        {warrantyAlerts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Žádné záruky brzy nevyprší</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {warrantyAlerts.slice(0, 5).map(d => {
              const expired = new Date(d.warranty_end_date) < new Date();
              return (
                <Link key={d.id} to={`/projekty/${d.project_id}?tab=service`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${expired ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                    <Shield className={`w-4 h-4 ${expired ? 'text-red-400' : 'text-amber-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{d.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{d.project_name}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${expired ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {expired ? 'Vypršela' : new Date(d.warranty_end_date).toLocaleDateString('cs-CZ')}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-card p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-cyan-400" />Servisní tikety
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`text-4xl font-extrabold ${openTicketsCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{openTicketsCount}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">{openTicketsCount > 0 ? 'otevřených tiketů' : 'žádné otevřené tikety'}</div>
          {openTicketsCount > 0 && (
            <Link to="/servis" className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Zobrazit tikety
            </Link>
          )}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />Rychlé zakázky
          </h3>
          <Link to="/rychle-zakazky" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 group transition-colors">
            Detail <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        {quickJobAlerts.length === 0 && quickJobPoolCount === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Žádné aktivní zakázky</div>
        ) : (
          <div>
            {quickJobPoolCount > 0 && (
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">V poolu</span>
                <span className="text-sm font-extrabold text-amber-400">{quickJobPoolCount}</span>
              </div>
            )}
            <div className="divide-y divide-white/[0.06]">
              {quickJobAlerts.slice(0, 4).map(j => {
                const priorityColor = j.priority === 'urgent' ? 'bg-red-500' : j.priority === 'high' ? 'bg-amber-500' : 'bg-slate-500';
                return (
                  <Link key={j.id} to="/rychle-zakazky" className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{j.title}</div>
                      {j.client_name && <div className="text-[10px] text-slate-500 truncate flex items-center gap-1"><User className="w-2.5 h-2.5" />{j.client_name}</div>}
                    </div>
                    {j.scheduled_date && (
                      <div className="text-[10px] font-bold text-cyan-400 shrink-0">
                        {new Date(j.scheduled_date).toLocaleDateString('cs-CZ')}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
