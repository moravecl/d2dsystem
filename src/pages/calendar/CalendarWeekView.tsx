import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon, CheckSquare,
  FolderKanban, AlertTriangle, Wrench, Plus, User, Briefcase,
} from 'lucide-react';
import type { CalendarEvent } from './calendarTypes';
import { DAY_NAMES_FULL, dateToStr, getEventsForDate, getWeekStart, addDays, isSameDay } from './calendarTypes';
import CalendarEventTooltip from './CalendarEventTooltip';

const TYPE_ICONS: Record<string, typeof CalendarIcon> = {
  task: CheckSquare, milestone: FolderKanban, deadline: AlertTriangle,
  due_item: Wrench, vacation: CalendarIcon,
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (dateStr: string) => void;
  onDragCreate?: (dateStr: string, startHour: number, endHour: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

interface DragState {
  dayIdx: number;
  startHour: number;
  endHour: number;
}

export default function CalendarWeekView({ currentDate, events, onDayClick, onDragCreate, onEventClick }: Props) {
  const [tooltip, setTooltip] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const isDragging = useRef(false);
  const weekStart = getWeekStart(currentDate);
  const today = new Date();

  const showTooltip = useCallback((e: React.MouseEvent, evt: CalendarEvent) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ event: evt, rect });
  }, []);

  const hideTooltip = useCallback(() => {
    hideTimer.current = setTimeout(() => setTooltip(null), 120);
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, dateStr: dateToStr(d), isToday: isSameDay(d, today) };
  });

  const handleMouseDown = useCallback((dayIdx: number, hour: number) => {
    isDragging.current = true;
    setDrag({ dayIdx, startHour: hour, endHour: hour + 1 });
  }, []);

  const handleMouseMove = useCallback((hour: number) => {
    if (!isDragging.current || !drag) return;
    const newEnd = Math.max(drag.startHour + 1, hour + 1);
    setDrag(prev => prev ? { ...prev, endHour: newEnd } : null);
  }, [drag]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !drag) { isDragging.current = false; return; }
    isDragging.current = false;
    const wd = weekDays[drag.dayIdx];
    if (wd && onDragCreate) {
      onDragCreate(wd.dateStr, drag.startHour, drag.endHour);
    } else if (wd) {
      onDayClick(wd.dateStr);
    }
    setDrag(null);
  }, [drag, weekDays, onDragCreate, onDayClick]);

  const isInDragRange = (dayIdx: number, hour: number) => {
    if (!drag || drag.dayIdx !== dayIdx) return false;
    return hour >= drag.startHour && hour < drag.endHour;
  };

  const dayData = useMemo(() => {
    return weekDays.map(wd => {
      const all = getEventsForDate(events, wd.dateStr);
      const allDay = all.filter(e => e.startHour === undefined);
      const timed = all.filter(e => e.startHour !== undefined);
      return { allDay, timed };
    });
  }, [weekDays, events]);

  const getTimedEventsForHour = (dayIdx: number, hour: number) => {
    return dayData[dayIdx].timed.filter(e => e.startHour === hour);
  };

  return (
    <>
      <div className="flex flex-col" onMouseUp={handleMouseUp} onMouseLeave={() => { if (isDragging.current) handleMouseUp(); }}>
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/10">
          <div className="bg-white/[0.04] border-r border-white/10" />
          {weekDays.map((wd, i) => (
            <div
              key={i}
              className={`px-2 py-3 text-center border-r border-white/[0.06] last:border-r-0 ${wd.isToday ? 'bg-blue-500/10' : 'bg-white/[0.04]'}`}
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase">{DAY_NAMES_FULL[i]}</div>
              <div className={`text-lg font-bold mt-0.5 ${wd.isToday ? 'text-blue-400' : 'text-white'}`}>
                {wd.date.getDate()}
              </div>
              <div className="text-[10px] text-slate-400">{wd.date.toLocaleDateString('cs-CZ', { month: 'short' })}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/[0.06] bg-white/[0.06]">
          <div className="border-r border-white/10 px-1 py-2">
            <span className="text-[9px] font-semibold text-slate-400 uppercase">Cely den</span>
          </div>
          {weekDays.map((wd, i) => {
            const allDayEvents = dayData[i].allDay;
            return (
              <div
                key={i}
                className={`border-r border-white/[0.06] last:border-r-0 p-1.5 min-h-[60px] group/cell relative ${wd.isToday ? 'bg-blue-500/10/30' : ''}`}
              >
                <button
                  onClick={() => onDayClick(wd.dateStr)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-blue-500/20 hover:text-blue-400 opacity-0 group-hover/cell:opacity-100 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <div className="space-y-0.5">
                  {allDayEvents.slice(0, 4).map(evt => {
                    const Icon = TYPE_ICONS[evt.type] || CalendarIcon;
                    const hasExtra = evt.assignee || evt.project;
                    const content = (
                      <div
                        className={`px-1 py-0.5 rounded text-[9px] font-semibold cursor-pointer ${evt.color}`}
                        onMouseEnter={(e) => showTooltip(e, evt)}
                        onMouseLeave={hideTooltip}
                      >
                        <div className="flex items-center gap-0.5 truncate">
                          <Icon className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{evt.title}</span>
                        </div>
                        {hasExtra && (
                          <div className="flex items-center gap-1 mt-px opacity-70 truncate">
                            {evt.assignee && (
                              <span className="inline-flex items-center gap-px truncate">
                                <User className="w-2 h-2 shrink-0" />
                                <span className="truncate">{evt.assignee.split(',')[0]}</span>
                              </span>
                            )}
                            {evt.project && (
                              <span className="inline-flex items-center gap-px truncate">
                                <Briefcase className="w-2 h-2 shrink-0" />
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
                  {allDayEvents.length > 4 && (
                    <span className="text-[9px] text-blue-500 font-semibold px-1">+{allDayEvents.length - 4}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-y-auto max-h-[500px] select-none">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-50 min-h-[40px]">
              <div className="border-r border-white/10 px-2 py-1 flex items-start justify-end">
                <span className="text-[10px] font-semibold text-slate-400">{String(hour).padStart(2, '0')}:00</span>
              </div>
              {weekDays.map((wd, i) => {
                const isNow = wd.isToday && today.getHours() === hour;
                const inDrag = isInDragRange(i, hour);
                const timedHere = getTimedEventsForHour(i, hour);
                return (
                  <div
                    key={i}
                    onMouseDown={(e) => { e.preventDefault(); handleMouseDown(i, hour); }}
                    onMouseEnter={() => handleMouseMove(hour)}
                    className={`border-r border-slate-50 last:border-r-0 cursor-pointer transition relative ${
                      inDrag
                        ? 'bg-blue-500/20/60'
                        : isNow
                          ? 'bg-blue-500/10/20'
                          : 'hover:bg-blue-500/100/10/40'
                    }`}
                  >
                    {isNow && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/100 z-10" />
                    )}
                    {timedHere.map(evt => {
                      const Icon = TYPE_ICONS[evt.type] || CalendarIcon;
                      const spans = (evt.endHour || evt.startHour! + 1) - evt.startHour!;
                      const height = spans * 40;
                      const hasExtra = evt.assignee || evt.project;
                      const content = (
                        <div
                          className={`absolute inset-x-0.5 top-0.5 rounded-md px-1 py-0.5 text-[9px] font-semibold cursor-pointer z-20 overflow-hidden ${evt.color} border-l-2 border-current`}
                          style={{ height: `${height - 4}px` }}
                          onMouseEnter={(e) => { e.stopPropagation(); showTooltip(e, evt); }}
                          onMouseLeave={hideTooltip}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-0.5">
                            <Icon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{evt.meta?.Cas}</span>
                          </div>
                          <div className="truncate font-bold">{evt.title}</div>
                          {hasExtra && spans >= 2 && (
                            <div className="flex items-center gap-1 mt-px opacity-70 truncate">
                              {evt.assignee && (
                                <span className="inline-flex items-center gap-px truncate">
                                  <User className="w-2 h-2 shrink-0" />
                                  <span className="truncate">{evt.assignee.split(',')[0]}</span>
                                </span>
                              )}
                              {evt.project && (
                                <span className="inline-flex items-center gap-px truncate">
                                  <Briefcase className="w-2 h-2 shrink-0" />
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
                      <div className="absolute inset-x-1 top-0.5 bottom-0 rounded-t bg-blue-500/100/20 border-l-2 border-blue-500 pointer-events-none z-30">
                        <span className="text-[9px] font-bold text-blue-400 px-1">{String(drag!.startHour).padStart(2, '0')}:00 - {String(drag!.endHour).padStart(2, '0')}:00</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
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
