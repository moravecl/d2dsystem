import { ArrowRight, Activity } from 'lucide-react';
import StatusBadge from '../../ui/StatusBadge';
import type { DashboardData, AuditEntry } from '../dashboardTypes';

interface Props {
  data: DashboardData;
  editMode: boolean;
}

export default function ActivityWidget({ data, editMode }: Props) {
  const { activityFeed, profiles } = data;

  const getProfileName = (id: string | null) => {
    if (!id) return '';
    const p = profiles.find(pr => pr.id === id);
    return p?.display_name || p?.email || '';
  };

  const fmtAction = (entry: AuditEntry) => {
    const who = getProfileName(entry.user_id);
    const typeLabel: Record<string, string> = { project: 'projekt', task: 'úkol', invoice: 'fakturu', project_document: 'dokument', client: 'klienta' };
    const actionLabel: Record<string, string> = { created: 'vytvořil/a', updated: 'aktualizoval/a', deleted: 'smazal/a', status_changed: 'změnil/a stav', regenerated: 'přegeneroval/a' };
    return `${who || 'Uživatel'} ${actionLabel[entry.action] || entry.action} ${typeLabel[entry.entity_type] || entry.entity_type}`;
  };

  return (
    <div className={`glass-card overflow-hidden ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950' : ''}`}>
      <div className="px-5 py-4 border-b border-white/[0.07]">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" />Poslední aktivita</h2>
      </div>
      {activityFeed.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">Žádná aktivita</div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {activityFeed.map(entry => (
            <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.04] transition">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center shrink-0 ring-1 ring-blue-500/20">
                <span className="text-xs font-bold text-blue-400">{(getProfileName(entry.user_id) || 'U')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-300">{fmtAction(entry)}</div>
                {entry.action === 'status_changed' && typeof entry.details?.from === 'string' && (
                  <div className="flex items-center gap-1 mt-0.5"><StatusBadge status={entry.details.from} /><ArrowRight className="w-3 h-3 text-slate-600" /><StatusBadge status={String(entry.details.to)} /></div>
                )}
              </div>
              <div className="text-[10px] text-slate-500 shrink-0">{new Date(entry.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
