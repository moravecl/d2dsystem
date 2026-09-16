import { useEffect, useState } from 'react';
import { GanttChart } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Milestone {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  color: string;
  progress: number;
}

interface Props {
  projectId: string;
  /** Klik na milník předá jeho termíny (např. do formuláře poptávky). */
  onPickRange?: (from: string, to: string) => void;
}

const DAY = 24 * 60 * 60 * 1000;
const PX_PER_DAY = 4;
const LABEL_COL = 116;

/**
 * Kompaktní read-only Gantt projektu (project_milestones). Názvy fází jsou
 * v pevném levém sloupci, časová osa se u dlouhých projektů posouvá
 * vodorovně (min. šířka na den), aby byl harmonogram vždy čitelný celý.
 * Používá se v přiřazení subdodavatele a počítá se s ním i pro portál
 * subdodavatele (fáze 2).
 */
export default function ProjectMiniGantt({ projectId, onPickRange }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('project_milestones')
      .select('id, name, start_date, end_date, status, color, progress')
      .eq('project_id', projectId)
      .order('sort_order').order('start_date')
      .then(({ data }) => {
        setMilestones(((data || []) as Milestone[]).filter(m => m.start_date && m.end_date));
        setLoading(false);
      });
  }, [projectId]);

  if (loading) return null;
  if (milestones.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
        <GanttChart className="w-3.5 h-3.5" />
        Projekt zatím nemá plán v Ganttu — termíny zadejte ručně.
      </div>
    );
  }

  const minT = Math.min(...milestones.map(m => new Date(m.start_date).getTime()));
  const maxT = Math.max(...milestones.map(m => new Date(m.end_date).getTime() + DAY));
  const span = Math.max(maxT - minT, DAY);
  const days = Math.ceil(span / DAY);
  const innerWidth = Math.max(days * PX_PER_DAY, 420);
  const pos = (t: number) => ((t - minT) / span) * innerWidth;
  const todayT = Date.now();
  const todayPx = todayT >= minT && todayT <= maxT ? pos(todayT) : null;

  const monthTicks: { label: string; px: number }[] = [];
  const cursor = new Date(minT);
  cursor.setDate(1);
  while (cursor.getTime() < maxT) {
    const t = cursor.getTime();
    if (t >= minT) {
      monthTicks.push({ label: cursor.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' }), px: pos(t) });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1.5">
          <GanttChart className="w-3.5 h-3.5 text-teal-400" /> Harmonogram projektu
        </span>
        {onPickRange && <span className="text-[10px] text-slate-500">Kliknutím na fázi převezmete její termíny</span>}
      </div>

      <div className="flex">
        {/* pevný sloupec s názvy fází */}
        <div className="shrink-0 pr-2" style={{ width: LABEL_COL }}>
          <div className="h-5" />
          <div className="space-y-1 pt-1">
            {milestones.map(m => (
              <div key={m.id} className="h-6 flex items-center">
                <span className="text-[11px] font-semibold text-slate-300 truncate" title={m.name}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* posuvná časová osa */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ width: innerWidth }}>
            <div className="relative h-5 border-b border-white/[0.08]">
              {monthTicks.map((tick, i) => (
                <span key={i} className="absolute top-0.5 text-[9px] text-slate-500" style={{ left: tick.px + 2 }}>
                  {tick.label}
                </span>
              ))}
              {monthTicks.map((tick, i) => (
                <span key={`l${i}`} className="absolute top-0 bottom-0 w-px bg-white/[0.06]" style={{ left: tick.px }} />
              ))}
            </div>

            <div className="relative space-y-1 pt-1">
              {todayPx !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-red-400/70 z-10" style={{ left: todayPx }} title="Dnes" />
              )}
              {milestones.map(m => {
                const left = pos(new Date(m.start_date).getTime());
                const width = Math.max(pos(new Date(m.end_date).getTime() + DAY) - left, 6);
                const range = `${new Date(m.start_date).toLocaleDateString('cs-CZ')} – ${new Date(m.end_date).toLocaleDateString('cs-CZ')}`;
                return (
                  <div key={m.id} className="relative h-6">
                    <button
                      type="button"
                      disabled={!onPickRange}
                      onClick={() => onPickRange?.(m.start_date, m.end_date)}
                      title={`${m.name} · ${range}`}
                      className={`absolute top-0 h-6 rounded-md overflow-hidden border border-black/20 ${onPickRange ? 'cursor-pointer hover:ring-2 hover:ring-white/40' : 'cursor-default'}`}
                      style={{ left, width, backgroundColor: `${m.color || '#3b82f6'}55` }}
                    >
                      <div className="absolute inset-y-0 left-0" style={{ width: `${m.progress || 0}%`, backgroundColor: m.color || '#3b82f6' }} />
                      {width > 90 && (
                        <span className="relative z-10 px-1.5 text-[9px] font-bold text-white/90 whitespace-nowrap leading-6 drop-shadow">
                          {range}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
