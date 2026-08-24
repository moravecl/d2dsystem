import { MousePointer2, Camera, Route, Monitor, Network, Ruler, Move } from 'lucide-react';
import type { CanvasMode } from './CameraCanvas';

interface Props {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  showFov: boolean;
  showIrRange: boolean;
  onToggleFov: () => void;
  onToggleIrRange: () => void;
}

const TOOLS: { mode: CanvasMode; icon: typeof Camera; label: string; shortcut: string }[] = [
  { mode: 'navigate', icon: MousePointer2, label: 'Navigace', shortcut: 'V' },
  { mode: 'place_camera', icon: Camera, label: 'Vložit kameru', shortcut: 'C' },
  { mode: 'draw_route', icon: Route, label: 'Kreslit trasu', shortcut: 'R' },
  { mode: 'place_nvr', icon: Monitor, label: 'Umístit NVR', shortcut: 'N' },
  { mode: 'place_switch', icon: Network, label: 'Umístit switch', shortcut: 'S' },
  { mode: 'set_scale', icon: Ruler, label: 'Měřítko', shortcut: 'M' },
];

export default function CameraToolbar({ mode, onModeChange, showFov, showIrRange, onToggleFov, onToggleIrRange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-sm rounded-xl px-2 py-1.5 shadow-xl border border-slate-700/50">
      {TOOLS.map(tool => {
        const Icon = tool.icon;
        const active = mode === tool.mode;
        return (
          <button
            key={tool.mode}
            onClick={() => onModeChange(tool.mode)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        );
      })}

      <div className="w-px h-6 bg-slate-700 mx-1" />

      <button
        onClick={onToggleFov}
        title="Zobrazit zorný úhel"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
          showFov ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <Move className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">FOV</span>
      </button>

      <button
        onClick={onToggleIrRange}
        title="Zobrazit IR dosah"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
          showIrRange ? 'bg-red-600/20 text-red-400 ring-1 ring-red-500/30' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" strokeDasharray="3 2" />
        </svg>
        <span className="hidden lg:inline">IR</span>
      </button>
    </div>
  );
}
