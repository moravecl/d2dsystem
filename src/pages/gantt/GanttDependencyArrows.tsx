import { useEffect, useState, useCallback } from 'react';
import type { Milestone } from './ganttTypes';
import { daysBetween } from './ganttTypes';

interface Props {
  milestones: Milestone[];
  startDate: Date;
  totalDays: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  rowHeight: number;
  headerHeight: number;
  sidebarWidth: number;
}

interface ArrowPath {
  id: string;
  d: string;
  color: string;
}

export default function GanttDependencyArrows({
  milestones,
  startDate,
  totalDays,
  containerRef,
  rowHeight,
  headerHeight,
  sidebarWidth,
}: Props) {
  const [arrows, setArrows] = useState<ArrowPath[]>([]);

  const computeArrows = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.offsetWidth - sidebarWidth;
    if (containerWidth <= 0) return;

    const msIndexMap = new Map<string, number>();
    const flatList: Milestone[] = [];
    const rows = container.querySelectorAll('[data-milestone-id]');
    rows.forEach((row, idx) => {
      const msId = row.getAttribute('data-milestone-id');
      if (msId) {
        const ms = milestones.find(m => m.id === msId);
        if (ms) {
          msIndexMap.set(msId, idx);
          flatList.push(ms);
        }
      }
    });

    const getBarX = (ms: Milestone) => {
      const s = new Date(ms.start_date);
      const e = new Date(ms.end_date);
      const leftDay = Math.max(0, daysBetween(startDate, s));
      const rightDay = Math.min(totalDays, daysBetween(startDate, e) + 1);
      const leftPx = (leftDay / totalDays) * containerWidth + sidebarWidth;
      const rightPx = (rightDay / totalDays) * containerWidth + sidebarWidth;
      return { left: leftPx, right: rightPx, center: (leftPx + rightPx) / 2 };
    };

    const newArrows: ArrowPath[] = [];

    for (const ms of flatList) {
      if (!ms.depends_on || ms.depends_on.length === 0) continue;
      const targetIdx = msIndexMap.get(ms.id);
      if (targetIdx === undefined) continue;

      for (const depId of ms.depends_on) {
        const sourceIdx = msIndexMap.get(depId);
        if (sourceIdx === undefined) continue;
        const sourceMilestone = milestones.find(m => m.id === depId);
        if (!sourceMilestone) continue;

        const sourceBar = getBarX(sourceMilestone);
        const targetBar = getBarX(ms);

        const startX = sourceBar.right;
        const startY = headerHeight + sourceIdx * rowHeight + rowHeight / 2;
        const endX = targetBar.left;
        const endY = headerHeight + targetIdx * rowHeight + rowHeight / 2;

        const gapX = Math.max(8, (endX - startX) * 0.15);

        let d: string;
        if (endX > startX + 20) {
          d = `M ${startX} ${startY} C ${startX + gapX} ${startY}, ${endX - gapX} ${endY}, ${endX} ${endY}`;
        } else {
          const loopY = Math.max(startY, endY) + rowHeight * 0.6;
          d = `M ${startX} ${startY} L ${startX + gapX} ${startY} Q ${startX + gapX + 6} ${startY}, ${startX + gapX + 6} ${startY + 6} L ${startX + gapX + 6} ${loopY - 6} Q ${startX + gapX + 6} ${loopY}, ${startX + gapX} ${loopY} L ${endX - gapX} ${loopY} Q ${endX - gapX - 6} ${loopY}, ${endX - gapX - 6} ${loopY - 6} L ${endX - gapX - 6} ${endY + 6} Q ${endX - gapX - 6} ${endY}, ${endX - gapX} ${endY} L ${endX} ${endY}`;
        }

        newArrows.push({ id: `${depId}-${ms.id}`, d, color: ms.color });
      }
    }

    setArrows(newArrows);
  }, [milestones, startDate, totalDays, containerRef, rowHeight, headerHeight, sidebarWidth]);

  useEffect(() => {
    computeArrows();
    const observer = new ResizeObserver(computeArrows);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [computeArrows]);

  if (arrows.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-20 overflow-visible" style={{ width: '100%', height: '100%' }}>
      <defs>
        {arrows.map(a => (
          <marker key={`marker-${a.id}`} id={`arrow-${a.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={a.color} opacity="0.7" />
          </marker>
        ))}
      </defs>
      {arrows.map(a => (
        <path
          key={a.id}
          d={a.d}
          fill="none"
          stroke={a.color}
          strokeWidth="1.5"
          strokeOpacity="0.5"
          markerEnd={`url(#arrow-${a.id})`}
          className="transition-all duration-200"
        />
      ))}
    </svg>
  );
}
