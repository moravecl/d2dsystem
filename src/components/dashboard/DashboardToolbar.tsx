import { useState, useRef, useEffect } from 'react';
import { Settings2, GripVertical, Eye, EyeOff, RotateCcw, Check, Loader2 } from 'lucide-react';
import { ALL_WIDGET_IDS, WIDGET_LABELS } from '../../hooks/useDashboardLayout';
import type { WidgetId } from '../../hooks/useDashboardLayout';

interface DashboardToolbarProps {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  hiddenWidgets: WidgetId[];
  saving: boolean;
  onToggleWidget: (id: WidgetId) => void;
  onReset: () => void;
}

export default function DashboardToolbar({
  editMode,
  setEditMode,
  hiddenWidgets,
  saving,
  onToggleWidget,
  onReset,
}: DashboardToolbarProps) {
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    if (showPanel) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPanel]);

  return (
    <div className="flex items-center gap-2">
      {saving && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Ukládám...</span>
        </div>
      )}

      {editMode ? (
        <button
          onClick={() => setEditMode(false)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 rounded-lg hover:bg-emerald-500/20 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Hotovo
        </button>
      ) : (
        <button
          onClick={() => setEditMode(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-white/[0.07] border border-white/10 rounded-lg hover:bg-white/[0.12] hover:text-white transition-colors"
        >
          <GripVertical className="w-3.5 h-3.5" />
          Upravit rozložení
        </button>
      )}

      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setShowPanel(p => !p)}
          className={`p-2 rounded-lg border transition-colors ${
            showPanel
              ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
              : 'bg-white/[0.07] border-white/10 text-slate-400 hover:bg-white/[0.12] hover:text-white'
          }`}
        >
          <Settings2 className="w-4 h-4" />
        </button>

        {showPanel && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-navy-800/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fade-in">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Widgety</span>
              <button
                onClick={() => { onReset(); setShowPanel(false); }}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Obnovit výchozí
              </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {ALL_WIDGET_IDS.map(id => {
                const isHidden = hiddenWidgets.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => onToggleWidget(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isHidden
                        ? 'text-slate-500 hover:bg-white/[0.04]'
                        : 'text-slate-200 hover:bg-blue-500/10'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isHidden ? 'bg-white/[0.05]' : 'bg-blue-500/15'
                    }`}>
                      {isHidden ? (
                        <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                    <span className={`text-sm font-medium flex-1 ${isHidden ? 'line-through text-slate-500' : ''}`}>
                      {WIDGET_LABELS[id]}
                    </span>
                    {isHidden && (
                      <span className="text-[9px] font-bold text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">Skryto</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
