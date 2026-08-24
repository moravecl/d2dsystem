import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon, CheckSquare,
  FolderKanban, AlertTriangle, Wrench, Plus, User, Briefcase,
} from 'lucide-react';
import type { CalendarEvent } from './calendarTypes';
import { DAY_NAMES_FULL, dateToStr, getEventsForDate, isSameDay } from './calendarTypes';
import CalendarEventTooltip from './CalendarEventTooltip';

const TYPE_ICONS: Record<string, typeof CalendarIcon> = {
  task: CheckSquare, milestone: FolderKanban, deadline: AlertTriangle,
  due_item: Wrench, vacation: CalendarIcon,
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (dateStr: string) => void;
  onDragCreate?: (dateStr: string, startHour: number, endHour: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

interface DragState {
  startHour: number;
  endHour: number;
}

export default function CalendarDayView({ currentDate, events, onDayClick, onDragCreate, onEventClick }: Props) {
  const [tooltip, setTooltip] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const isDragging = useRef(false);

  const today = new Date();
  const isToday = isSameDay(currentDate, today);
  const dateStr = dateToStr(currentDate);
  const dayEvents = getEventsForDate(events, dateStr);
  const dayOfWeek = (currentDate.getDay() + 6) % 7;

  const { allDayEvents, timedEvents } = useMemo(() => {
    return {
      allDayEvents: dayEvents.filter(e => e.startHour === undefined),
      timedEvents: dayEvents.filter(e => e.startHour !== undefined),
    };
  }, [dayEvents]);

  const showTooltip = useCallback((e: React.MouseEvent, evt: CalendarEvent) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ event: evt, rect });
  }, []);

  const hideTooltip = useCallback(() => {
    hideTimer.current = setTimeout(() => setTooltip(null), 120);
  }, []);

  const handleMouseDown = useCallback((hour: number) => {
    isDragging.current = true;
    setDrag({ startHour: hour, endHour: hour + 1 });
  }, []);

  const handleMouseMove = useCallback((hour: number) => {
    if (!isDragging.current || !drag) return;
    const newEnd = Math.max(drag.startHour + 1, hour + 1);
    setDrag(prev => prev ? { ...prev, endHour: newEnd } : null);
  }, [drag]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !drag) { isDragging.current = false; return; }
    isDragging.current = false;
    if (onDragCreate) {
      onDragCreate(dateStr, drag.startHour, drag.endHour);
    } else {
      onDayClick(dateStr);
    }
    setDrag(null);
  }, [drag, dateStr, onDragCreate, onDayClick]);

  const isInDragRange = (hour: number) => {
    if (!drag) return false;
    return hour >= drag.startHour && hour < drag.endHour;
  };

  const getTimedEventsForHour = (hour: number) => {
    return timedEvents.filter(e => e.startHour === hour);
  };

  return (
    <>
      <div className="flex flex-col" onMouseUp={handleMouseUp} onMouseLeave={() => { if (isDragging.current) handleMouseUp(); }}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 bg-white/[0.04]">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">{DAY_NAMES_FULL[dayOfWeek]}</div>
            <div className={`text-2xl font-bold mt-0.5 ${isToday ? 'text-blue-400' : 'text-white'}`}>
              {currentDate.getDate()}. {currentDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <button
            onClick={() => onDayClick(dateStr)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Nový záznam
          </button>
        </div>

        {allDayEvents.length > 0 && (
          <div className="border-b border-white/[0.06] bg-white/[0.06] p-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Celodenní / bez času ({allDayEvents.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {allDayEvents.map(evt => {
                const Icon = TYPE_ICONS[evt.type] || CalendarIcon;
                const hasExtra = evt.assignee || evt.project;
                const content = (
                  <div
                    className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer ${evt.color}`}
                    onMouseEnter={(e) => showTooltip(e, evt)}
                    onMouseLeave={hideTooltip}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[200px]">{evt.title}</span>
                    </div>
                    {hasExtra && (
                      <div className="flex items-center gap-2 mt-0.5 opacity-70 text-[10px]">
                        {evt.assignee && (
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <User className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{evt.assignee}</span>
                          </span>
                        )}
                        {evt.project && (
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <Briefcase className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{evt.project}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
                return (
                  <div key={evt.id} onClick={(e) => { e.stopPropagation(); onEventClick?.(evt); }} className="hover:opacity-80 transition">
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-y-auto max-h-[600px] select-none">
          {HOURS.map(hour => {
            const isNow = isToday && today.getHours() === hour;
            const inDrag = isInDragRange(hour);
            const timedHere = getTimedEventsForHour(hour);
            return (
              <div
                key={hour}
                onMouseDown={(e) => { e.preventDefault(); handleMouseDown(hour); }}
                onMouseEnter={() => handleMouseMove(hour)}
                className={`flex border-b border-slate-50 min-h-[48px] cursor-pointer transition relative ${
                  inDrag
                    ? 'bg-blue-500/20/60'
                    : isNow
                      ? 'bg-blue-500/10/20'
                      : 'hover:bg-blue-500/100/10/30'
                }`}
              >
                <div className="w-16 shrink-0 border-r border-white/10 px-2 py-2 flex items-start justify-end">
                  <span className="text-xs font-semibold text-slate-400">{String(hour).padStart(2, '0')}:00</span>
                </div>
                <div className="flex-1 p-1 relative">
                  {isNow && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/100 z-10" />
                  )}
                  {timedHere.map(evt => {
                    const Icon = TYPE_ICONS[evt.type] || CalendarIcon;
                    const spans = (evt.endHour || evt.startHour! + 1) - evt.startHour!;
                    const height = spans * 48;
                    const hasExtra = evt.assignee || evt.project;
                    const content = (
                      <div
                        className={`absolute left-1 right-1 top-0 rounded-lg px-2 py-1 text-xs font-semibold cursor-pointer z-20 overflow-hidden ${evt.color} border-l-3 border-current`}
                        style={{ height: `${height - 4}px` }}
                        onMouseEnter={(e) => { e.stopPropagation(); showTooltip(e, evt); }}
                        onMouseLeave={hideTooltip}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <Icon className="w-3 h-3 shrink-0" />
                          <span className="font-bold">{evt.meta?.Cas}</span>
                          <span className="mx-1 opacity-50">|</span>
                          <span className="truncate">{evt.title}</span>
                        </div>
                        {evt.meta?.Misto && (
                          <div className="text-[10px] opacity-75 mt-0.5 truncate">{evt.meta.Misto}</div>
                        )}
                        {hasExtra && (
                          <div className="flex items-center gap-2 mt-0.5 opacity-70 text-[10px]">
                            {evt.assignee && (
                              <span className="inline-flex items-center gap-0.5 truncate">
                                <User className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{evt.assignee}</span>
                              </span>
                            )}
                            {evt.project && (
                              <span className="inline-flex items-center gap-0.5 truncate">
                                <Briefcase className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{evt.project}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                    return (
                      <div key={evt.id} onClick={(e) => { e.stopPropagation(); onEventClick?.(evt); }} className="hover:opacity-80">
                        {content}
                      </div>
                    );
                  })}
                  {inDrag && hour === drag!.startHour && (
                    <div className="absolute inset-x-1 top-0.5 bottom-0 rounded-t bg-blue-500/100/20 border-l-2 border-blue-500 pointer-events-none">
                      <span className="text-[9px] font-bold text-blue-400 px-1">{String(drag!.startHour).padStart(2, '0')}:00 - {String(drag!.endHour).padStart(2, '0')}:00</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {dayEvents.length === 0 && (
          <div className="py-12 text-center">
            <CalendarIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Žádné udalosti pro tento den</p>
            <button
              onClick={() => onDayClick(dateStr)}
              className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-400"
            >
              Vytvořit záznam
            </button>
          </div>
        )}
      </div>
      {tooltip && (
        <CalendarEventTooltip
          event={tooltip.event}
          anchorRect={tooltip.rect}
        />
      )}
    </>
  );
}
