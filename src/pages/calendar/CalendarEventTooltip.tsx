import { useLayoutEffect, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon, CheckSquare,
  FolderKanban, AlertTriangle, Wrench, User, Briefcase,
} from 'lucide-react';
import type { CalendarEvent } from './calendarTypes';
import { TYPE_LABELS } from './calendarTypes';

const TYPE_ICONS: Record<string, typeof CalendarIcon> = {
  task: CheckSquare, milestone: FolderKanban, deadline: AlertTriangle,
  due_item: Wrench, vacation: CalendarIcon,
};

interface Props {
  event: CalendarEvent;
  anchorRect: DOMRect;
}

export default function CalendarEventTooltip({ event, anchorRect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = anchorRect.bottom + 6;
    let left = anchorRect.left + anchorRect.width / 2 - rect.width / 2;

    if (top + rect.height > window.innerHeight - 10) {
      top = anchorRect.top - rect.height - 6;
    }
    if (left < 10) left = 10;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;

    setPos({ top, left });
  }, [anchorRect]);

  const Icon = TYPE_ICONS[event.type] || CalendarIcon;
  const d = new Date(event.date + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-navy-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 p-4 w-72 animate-scale-in pointer-events-none"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        opacity: pos ? 1 : 0,
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${event.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{event.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{TYPE_LABELS[event.type] || event.type}</p>
          <p className="text-xs text-slate-400 mt-1">{dateLabel}</p>
          {event.assignee && (
            <div className="flex items-center gap-1 mt-1.5">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600">{event.assignee}</span>
            </div>
          )}
          {event.project && (
            <div className="flex items-center gap-1 mt-1">
              <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600">{event.project}</span>
            </div>
          )}
          {event.meta && Object.entries(event.meta)
            .filter(([k]) => k !== 'Prirazeno' && k !== 'Ucastnici' && k !== 'Projekt')
            .map(([k, v]) => (
            <p key={k} className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold">{k}:</span> {v}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
