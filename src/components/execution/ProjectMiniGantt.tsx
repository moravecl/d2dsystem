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

/**
 * Read-only Gantt projektu (project_milestones) roztažený na celou šířku —
 * žádné vodorovné posouvání. Termíny každé fáze jsou vždy vypsané textem
 * v levém sloupci, pruhy jsou jen proporční vizualizace na společné ose.
 * Používá se v přiřazení subdodavatele a v partnerském portálu.
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
  const pct = (t: number) => ((t - minT) / span) * 100;
  const todayT = Date.now();
  const todayPct = todayT >= minT && todayT <= maxT ? pct(todayT) : null;

  const monthTicks: { label: string; pct: number }[] = [];
  const cursor = new Date(minT);
  cursor.setDate(1);
  while (cursor.getTime() < maxT) {
    const t = cursor.getTime();
    if (t >= minT) {
      monthTicks.push({ label: cursor.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' }), pct: pct(t) });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // u krátkých projektů se popisky měsíců nevejdou všechny — prořeď je
  const maxLabels = 8;
  const labelStep = Math.max(1, Math.ceil(monthTicks.length / maxLabels));

  const fmtD = (d: string) => new Date(d).toLocaleDateString('cs-CZ');
  const durDays = (m: Milestone) =>
    Math.max(1, Math.round((new Date(m.end_date).getTime() + DAY - new Date(m.start_date).getTime()) / DAY));

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1.5">
          <GanttChart className="w-3.5 h-3.5 text-teal-400" /> Harmonogram projektu
        </span>
        {onPickRange && <span className="text-[10px] text-slate-500">Kliknutím na fázi převezmete její termíny</span>}
      </div>

      {/* hlavička s měsíci nad časovou osou */}
      <div className="flex items-end">
        <div className="w-44 sm:w-52 shrink-0" />
        <div className="relative flex-1 h-5 border-b border-white/[0.1]">
          {monthTicks.map((tick, i) => (
            <span key={`l${i}`} className="absolute top-0 bottom-0 w-px bg-white/[0.08]" style={{ left: `${tick.pct}%` }} />
          ))}
          {monthTicks.filter((_, i) => i % labelStep === 0).map((tick, i) => (
            <span key={i} className="absolute top-0 text-[10px] font-semibold text-slate-400 whitespace-nowrap" style={{ left: `calc(${tick.pct}% + 3px)` }}>
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {milestones.map(m => {
          const left = pct(new Date(m.start_date).getTime());
          const width = Math.max(pct(new Date(m.end_date).getTime() + DAY) - left, 1.2);
          const done = (m.progress || 0) >= 100;
          const Row = onPickRange ? 'button' : 'div';
          return (
            <Row
              key={m.id}
              {...(onPickRange ? { type: 'button' as const, onClick: () => onPickRange(m.start_date, m.end_date) } : {})}
              className={`w-full flex items-center gap-0 rounded-lg px-0 py-1 text-left transition ${onPickRange ? 'hover:bg-white/[0.05] cursor-pointer' : ''}`}
            >
              <div className="w-44 sm:w-52 shrink-0 pr-3 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: m.color || '#3b82f6' }} />
                  <span className="text-xs font-bold text-slate-200 truncate" title={m.name}>{m.name}</span>
                </div>
                <div className="text-[10px] text-slate-500 pl-3.5 tabular-nums">
                  {fmtD(m.start_date)} – {fmtD(m.end_date)} · {durDays(m)} d{done ? ' · hotovo' : (m.progress || 0) > 0 ? ` · ${m.progress} %` : ''}
                </div>
              </div>
              <div className="relative flex-1 h-6 self-center">
                {monthTicks.map((tick, i) => (
                  <span key={`g${i}`} className="absolute top-0 bottom-0 w-px bg-white/[0.05]" style={{ left: `${tick.pct}%` }} />
                ))}
                {todayPct !== null && (
                  <span className="absolute top-0 bottom-0 w-0.5 bg-red-400/80 z-10 rounded-full" style={{ left: `${todayPct}%` }} title="Dnes" />
                )}
                <span
                  className="absolute top-1/2 -translate-y-1/2 h-4 rounded-full shadow-sm overflow-hidden"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: m.color || '#3b82f6' }}
                  title={`${m.name} · ${fmtD(m.start_date)} – ${fmtD(m.end_date)}`}
                >
                  {(m.progress || 0) < 100 && (
                    <span className="absolute inset-y-0 right-0 bg-black/40" style={{ width: `${100 - (m.progress || 0)}%` }} />
                  )}
                </span>
              </div>
            </Row>
          );
        })}
      </div>

      {todayPct !== null && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pl-1">
          <span className="w-2 h-0.5 bg-red-400 rounded-full" /> dnes
        </div>
      )}
    </div>
  );
}
