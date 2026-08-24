import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Calendar as CalendarIcon, CheckSquare,
  FolderKanban, AlertTriangle, Wrench, User, Briefcase,
  MapPin, Clock, ExternalLink, Sun,
} from 'lucide-react';
import type { CalendarEvent } from './calendarTypes';
import { TYPE_LABELS } from './calendarTypes';

const TYPE_ICONS: Record<string, typeof CalendarIcon> = {
  task: CheckSquare,
  milestone: FolderKanban,
  deadline: AlertTriangle,
  due_item: Wrench,
  vacation: Sun,
  service: Wrench,
  event: CalendarIcon,
};

const TYPE_COLORS: Record<string, string> = {
  task: 'bg-blue-500/100',
  milestone: 'bg-amber-500/100',
  deadline: 'bg-red-500/100',
  due_item: 'bg-orange-500/100',
  vacation: 'bg-teal-500/100',
  service: 'bg-cyan-500/100',
  event: 'bg-rose-500',
};

interface Props {
  event: CalendarEvent;
  onClose: () => void;
}

export default function CalendarEventDetailPopup({ event, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const Icon = TYPE_ICONS[event.type] || CalendarIcon;
  const accentColor = TYPE_COLORS[event.type] || 'bg-white/[0.04]0';
  const d = new Date(event.date + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const metaEntries = Object.entries(event.meta || {}).filter(
    ([k]) => !['Prirazeno', 'Ucastnici', 'Projekt', 'Cas', 'Misto'].includes(k)
  );

  const timeValue = event.meta?.Cas;
  const locationValue = event.meta?.Misto;
  const attendeesValue = event.meta?.Ucastnici;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-backdrop-enter"
        onClick={onClose}
      />
      <div className="relative bg-navy-800/60 rounded-2xl shadow-2xl shadow-slate-900/10 w-full max-w-md overflow-hidden animate-modal-enter">
        <div className={`${accentColor} h-1.5`} />

        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2.5 rounded-xl ${event.color} shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white leading-snug break-words">
                  {event.title}
                </h3>
                <span className={`inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${event.color}`}>
                  {TYPE_LABELS[event.type] || event.type}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-5 space-y-3">
          <div className="flex items-center gap-2.5 text-sm text-slate-400">
            <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{dateLabel}</span>
          </div>

          {timeValue && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{timeValue}</span>
            </div>
          )}

          {locationValue && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{locationValue}</span>
            </div>
          )}

          {event.assignee && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{event.assignee}</span>
            </div>
          )}

          {attendeesValue && !event.assignee && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{attendeesValue}</span>
            </div>
          )}

          {event.project && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{event.project}</span>
            </div>
          )}

          {metaEntries.length > 0 && (
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              {metaEntries.map(([k, v]) => (
                <div key={k} className="flex items-start gap-2.5 text-sm">
                  <span className="font-medium text-slate-500 shrink-0">{k}:</span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {event.link && (
          <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.04]/80 rounded-b-2xl">
            <Link
              to={event.link}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Přejít na detail
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
