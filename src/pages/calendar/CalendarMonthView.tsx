import { useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar as CalendarIcon, CheckSquare,
  FolderKanban, AlertTriangle, Wrench, Plus, User, Briefcase,
} from 'lucide-react';
import type { CalendarEvent, SpanningEvent } from './calendarTypes';
import { DAY_NAMES, dateToStr, getEventsForDate } from './calendarTypes';
import CalendarEventTooltip from './CalendarEventTooltip';

const TYPE_ICONS: Record<string, typeof CalendarIcon> = {
  task: CheckSquare, milestone: FolderKanban, deadline: AlertTriangle,
  due_item: Wrench, vacation: CalendarIcon,
};

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  spanningEvents?: SpanningEvent[];
  onDayClick: (dateStr: string) => void;
  onDragCreate?: (dateStr: string, startHour: number, endHour: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onProjectDrop?: (projectId: string, date: string) => void;
}

interface WeekRow {
  dates: (string | null)[];
  days: (number | null)[];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export default function CalendarMonthView({ currentDate, events, spanningEvents = [], onDayClick, onEventClick, onProjectDrop }: Props) {
  const [tooltip, setTooltip] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = dateToStr(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = useMemo<WeekRow[]>(() => {
    const rows: WeekRow[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const slice = cells.slice(i, i + 7);
      rows.push({
        days: slice,
        dates: slice.map(d => d !== null ? dateToStr(new Date(year, month, d)) : null),
      });
    }
    return rows;
  }, [cells, year, month]);

  const showTooltip = useCallback((e: React.MouseEvent, evt: CalendarEvent) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ event: evt, rect });
  }, []);

  const hideTooltip = useCallback(() => {
    hideTimer.current = setTimeout(() => setTooltip(null), 120);
  }, []);

  return (
    <>
      <div className="bg-white/[0.06]">
        <div className="grid grid-cols-7 gap-px">
          {DAY_NAMES.map(d => (
            <div key={d} className="bg-white/[0.04] text-center py-2 text-xs font-semibold text-slate-500 uppercase">{d}</div>
          ))}
        </div>

        {weeks.map((week, wi) => {
          const weekSpans = spanningEvents.filter(sp => {
            const validDates = week.dates.filter(Boolean) as string[];
            if (validDates.length === 0) return false;
            const weekStart = validDates[0];
            const weekEnd = validDates[validDates.length - 1];
            return sp.startDate <= weekEnd && sp.endDate >= weekStart;
          });

          const spanBars = weekSpans.map(sp => {
            let startCol = 0;
            let endCol = 6;
            for (let c = 0; c < 7; c++) {
              const d = week.dates[c];
              if (d && d >= sp.startDate) { startCol = c; break; }
            }
            for (let c = 6; c >= 0; c--) {
              const d = week.dates[c];
              if (d && d <= sp.endDate) { endCol = c; break; }
            }
            const isStart = sp.startDate >= (week.dates.find(Boolean) || '');
            const isEnd = sp.endDate <= (week.dates.filter(Boolean).pop() || '');
            return { ...sp, startCol, endCol, isStart, isEnd };
          });

          const spanRowHeight = spanBars.length > 0 ? spanBars.length * 22 + 2 : 0;

          return (
            <div key={wi} className="grid grid-cols-7 gap-px relative">
              {week.days.map((day, ci) => {
                if (day === null) return <div key={ci} className="bg-white/[0.06] min-h-[110px]" style={{ paddingTop: spanRowHeight }} />;

                const dateStr = week.dates[ci]!;
                const isToday = dateStr === today;
                const dayEvents = getEventsForDate(events, dateStr);

                return (
                  <div
                    key={ci}
                    className={`bg-white/[0.06] min-h-[110px] p-1.5 group/cell relative transition hover:bg-blue-500/100/10/30 ${isToday ? 'ring-2 ring-inset ring-blue-300' : ''} ${dropTarget === dateStr ? 'ring-2 ring-inset ring-blue-400 bg-blue-500/10/50' : ''}`}
                    style={{ paddingTop: spanRowHeight + 6 }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(dateStr); }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={e => { e.preventDefault(); setDropTarget(null); const pid = e.dataTransfer.getData('text/plain'); if (pid && onProjectDrop) onProjectDrop(pid, dateStr); }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-500'}`}>
                        {day}
                      </span>
                      <button
                        onClick={() => onDayClick(dateStr)}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-blue-500/20 hover:text-blue-400 opacity-0 group-hover/cell:opacity-100 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(evt => {
                        const Icon = TYPE_ICONS[evt.type] || CalendarIcon;
                        const hasExtra = evt.assignee || evt.project;
                        return (
                          <div key={evt.id} onClick={(e) => { e.stopPropagation(); onEventClick?.(evt); }} className="hover:opacity-80 transition">
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
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <button
                          onClick={() => onDayClick(dateStr)}
                          className="text-[9px] text-blue-500 font-semibold px-1 hover:underline"
                        >
                          +{dayEvents.length - 3} dalších
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {spanBars.map((bar, bi) => {
                const leftPct = (bar.startCol / 7) * 100;
                const widthPct = ((bar.endCol - bar.startCol + 1) / 7) * 100;
                const rgb = hexToRgb(bar.color);
                const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;
                const textColor = bar.color;
                const borderColor = bar.color;

                return (
                  <Link
                    key={bar.id + '-' + wi}
                    to={bar.link || '#'}
                    className="absolute z-10 flex items-center gap-1 text-[10px] font-semibold truncate hover:opacity-80 transition-opacity cursor-pointer"
                    style={{
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                      top: bi * 22 + 2,
                      height: 20,
                      backgroundColor: bgColor,
                      color: textColor,
                      borderLeft: bar.isStart ? `3px solid ${borderColor}` : 'none',
                      borderRadius: bar.isStart && bar.isEnd ? '4px' : bar.isStart ? '4px 0 0 4px' : bar.isEnd ? '0 4px 4px 0' : '0',
                      paddingLeft: bar.isStart ? 6 : 4,
                      paddingRight: 4,
                    }}
                    title={bar.title}
                  >
                    {bar.isStart && <FolderKanban className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{bar.title}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
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
