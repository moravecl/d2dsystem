import { useCallback, useRef, useState } from 'react';
import type { Milestone } from './ganttTypes';
import { daysBetween, addDays, dateToStr } from './ganttTypes';

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

interface Props {
  milestone: Milestone;
  startDate: Date;
  totalDays: number;
  onUpdate: (id: string, start_date: string, end_date: string) => void;
}

export default function GanttMilestoneBar({ milestone, startDate, totalDays, onUpdate }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragState = useRef<{
    mode: DragMode;
    startX: number;
    origLeftDay: number;
    origRightDay: number;
    containerWidth: number;
  } | null>(null);
  const [tempOffset, setTempOffset] = useState({ leftPct: 0, widthPct: 0 });

  const s = new Date(milestone.start_date);
  const e = new Date(milestone.end_date);
  const leftDay = Math.max(0, daysBetween(startDate, s));
  const rightDay = Math.min(totalDays, daysBetween(startDate, e) + 1);
  const widthDays = Math.max(1, rightDay - leftDay);
  const leftPct = (leftDay / totalDays) * 100;
  const widthPct = (widthDays / totalDays) * 100;

  const progressPct = milestone.progress || 0;

  const onMouseDown = useCallback((e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = barRef.current;
    if (!bar) return;
    const container = bar.closest('[data-gantt-timeline]');
    if (!container) return;

    const containerWidth = (container as HTMLElement).offsetWidth;
    setDragMode(mode);
    setTempOffset({ leftPct: 0, widthPct: 0 });

    dragState.current = {
      mode,
      startX: e.clientX,
      origLeftDay: leftDay,
      origRightDay: rightDay,
      containerWidth,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dayDelta = Math.round((dx / dragState.current.containerWidth) * totalDays);

      if (dragState.current.mode === 'move') {
        const newLeft = dragState.current.origLeftDay + dayDelta;
        const pctDelta = (dayDelta / totalDays) * 100;
        setTempOffset({ leftPct: pctDelta, widthPct: 0 });
      } else if (dragState.current.mode === 'resize-left') {
        const newLeft = Math.min(dragState.current.origRightDay - 1, dragState.current.origLeftDay + dayDelta);
        const clampedDelta = newLeft - dragState.current.origLeftDay;
        setTempOffset({ leftPct: (clampedDelta / totalDays) * 100, widthPct: -(clampedDelta / totalDays) * 100 });
      } else if (dragState.current.mode === 'resize-right') {
        const newRight = Math.max(dragState.current.origLeftDay + 1, dragState.current.origRightDay + dayDelta);
        const clampedDelta = newRight - dragState.current.origRightDay;
        setTempOffset({ leftPct: 0, widthPct: (clampedDelta / totalDays) * 100 });
      }
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!dragState.current) return;

      const dx = ev.clientX - dragState.current.startX;
      const dayDelta = Math.round((dx / dragState.current.containerWidth) * totalDays);

      let newStartDay = dragState.current.origLeftDay;
      let newEndDay = dragState.current.origRightDay;

      if (dragState.current.mode === 'move') {
        newStartDay += dayDelta;
        newEndDay += dayDelta;
      } else if (dragState.current.mode === 'resize-left') {
        newStartDay = Math.min(newEndDay - 1, newStartDay + dayDelta);
      } else if (dragState.current.mode === 'resize-right') {
        newEndDay = Math.max(newStartDay + 1, newEndDay + dayDelta);
      }

      const newStart = addDays(startDate, newStartDay);
      const newEnd = addDays(startDate, newEndDay - 1);

      setDragMode(null);
      setTempOffset({ leftPct: 0, widthPct: 0 });
      dragState.current = null;

      if (dayDelta !== 0) {
        onUpdate(milestone.id, dateToStr(newStart), dateToStr(newEnd));
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [milestone.id, startDate, totalDays, leftDay, rightDay, onUpdate]);

  const finalLeft = leftPct + tempOffset.leftPct;
  const finalWidth = widthPct + tempOffset.widthPct;

  return (
    <div
      ref={barRef}
      className={`absolute top-1.5 h-5 rounded-full  flex items-center transition-shadow group/bar ${dragMode ? 'shadow-lg ring-2 ring-blue-300' : ''}`}
      style={{
        left: `${finalLeft}%`,
        width: `${Math.max(0.5, finalWidth)}%`,
        backgroundColor: milestone.color,
        cursor: dragMode === 'move' ? 'grabbing' : 'grab',
        zIndex: dragMode ? 30 : 1,
      }}
    >
      {progressPct > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-30 bg-white/[0.06]"
          style={{ width: `${progressPct}%` }}
        />
      )}

      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize rounded-l-full z-10 hover:bg-white/[0.06]/30"
        onMouseDown={e => onMouseDown(e, 'resize-left')}
      />

      <div
        className="flex-1 px-1.5 cursor-grab active:cursor-grabbing min-w-0"
        onMouseDown={e => onMouseDown(e, 'move')}
      >
        <span className="text-[8px] font-extrabold text-white truncate whitespace-nowrap block">
          {milestone.name}
          {progressPct > 0 && <span className="ml-1 opacity-75">{progressPct}%</span>}
        </span>
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize rounded-r-full z-10 hover:bg-white/[0.06]/30"
        onMouseDown={e => onMouseDown(e, 'resize-right')}
      />
    </div>
  );
}
