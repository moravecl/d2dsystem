import { useState, useRef, useCallback } from 'react';
import type { WidgetId } from '../../hooks/useDashboardLayout';

interface DashboardGridProps {
  widgetOrder: WidgetId[];
  editMode: boolean;
  onReorder: (from: number, to: number) => void;
  renderWidget: (id: WidgetId) => React.ReactNode;
}

export default function DashboardGrid({ widgetOrder, editMode, onReorder, renderWidget }: DashboardGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef(0);
  const touchCurrentEl = useRef<number | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    requestAnimationFrame(() => {
      if (dragNode.current) dragNode.current.style.opacity = '0.4';
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNode.current) dragNode.current.style.opacity = '1';
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onReorder(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNode.current = null;
  }, [dragIndex, overIndex, onReorder]);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(idx);
  }, []);

  const handleTouchStart = useCallback((idx: number, e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentEl.current = idx;
    setDragIndex(idx);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const elements = Array.from(itemRefs.current.entries());
    for (const [idx, el] of elements) {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        setOverIndex(idx);
        break;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onReorder(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
    touchCurrentEl.current = null;
  }, [dragIndex, overIndex, onReorder]);

  const setItemRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(idx, el);
    else itemRefs.current.delete(idx);
  }, []);

  return (
    <div className="space-y-6">
      {widgetOrder.map((widgetId, idx) => {
        const isDragging = dragIndex === idx;
        const isOver = overIndex === idx && dragIndex !== idx;

        return (
          <div
            key={widgetId}
            ref={el => setItemRef(idx, el)}
            draggable={editMode}
            onDragStart={e => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => handleDragOver(e, idx)}
            onTouchStart={e => editMode && handleTouchStart(idx, e)}
            onTouchMove={e => editMode && handleTouchMove(e)}
            onTouchEnd={() => editMode && handleTouchEnd()}
            className={`
              relative transition-all duration-200
              ${editMode ? 'cursor-grab active:cursor-grabbing' : ''}
              ${isDragging ? 'opacity-40 scale-[0.98]' : ''}
              ${isOver ? 'ring-2 ring-blue-400 ring-offset-2 rounded-2xl' : ''}
            `}
          >
            {editMode && (
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              </div>
            )}
            {renderWidget(widgetId)}
          </div>
        );
      })}
    </div>
  );
}
