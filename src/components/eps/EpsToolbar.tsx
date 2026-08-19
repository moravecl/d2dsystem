import { MousePointer2, ShieldAlert, Route, Cpu, Volume2, Ruler, Eye, EyeOff, Scan, KeyRound, ToggleRight, Lock } from 'lucide-react';

export type EpsCanvasMode = 'navigate' | 'place_detector' | 'draw_route' | 'place_panel' | 'place_siren' | 'place_motion_sensor' | 'place_keypad' | 'place_control_device' | 'set_scale';

interface Props {
  mode: EpsCanvasMode;
  onModeChange: (mode: EpsCanvasMode) => void;
  showCoverage: boolean;
  showZones: boolean;
  onToggleCoverage: () => void;
  onToggleZones: () => void;
  scaleLocked?: boolean;
}

const TOOLS: { mode: EpsCanvasMode; icon: typeof ShieldAlert; label: string; shortcut: string }[] = [
  { mode: 'navigate', icon: MousePointer2, label: 'Navigace', shortcut: 'V' },
  { mode: 'place_detector', icon: ShieldAlert, label: 'Detektor', shortcut: 'D' },
  { mode: 'draw_route', icon: Route, label: 'Trasa kabelu', shortcut: 'R' },
  { mode: 'place_panel', icon: Cpu, label: 'Ustredna', shortcut: 'U' },
  { mode: 'place_siren', icon: Volume2, label: 'Sirena', shortcut: 'S' },
  { mode: 'place_motion_sensor', icon: Scan, label: 'PIR cidlo', shortcut: 'P' },
  { mode: 'place_keypad', icon: KeyRound, label: 'Klavesnice', shortcut: 'K' },
  { mode: 'place_control_device', icon: ToggleRight, label: 'Ovladac', shortcut: 'O' },
  { mode: 'set_scale', icon: Ruler, label: 'Meritko', shortcut: 'M' },
];

const ALWAYS_AVAILABLE: EpsCanvasMode[] = ['navigate', 'set_scale'];

export default function EpsToolbar({ mode, onModeChange, showCoverage, showZones, onToggleCoverage, onToggleZones, scaleLocked }: Props) {
  return (
    <div className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-sm rounded-xl px-2 py-1.5 shadow-xl border border-slate-700/50">
      {TOOLS.map(tool => {
        const Icon = tool.icon;
        const active = mode === tool.mode;
        const locked = scaleLocked && !ALWAYS_AVAILABLE.includes(tool.mode);
        const isScaleTool = tool.mode === 'set_scale';
        const pulseScale = scaleLocked && isScaleTool;
        return (
          <button
            key={tool.mode}
            onClick={() => !locked && onModeChange(tool.mode)}
            title={locked ? 'Nejprve nastavte meritko (M)' : `${tool.label} (${tool.shortcut})`}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              locked
                ? 'text-slate-600 cursor-not-allowed opacity-50'
                : active
                  ? pulseScale
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 animate-pulse'
                    : 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : pulseScale
                    ? 'text-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {locked && <Lock className="w-3 h-3 absolute -top-1 -right-1 text-slate-500" />}
            <Icon className="w-4 h-4" />
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        );
      })}

      <div className="w-px h-6 bg-slate-700 mx-1" />

      <button
        onClick={onToggleCoverage}
        title="Zobrazit pokryti detektoru"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
          showCoverage ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        {showCoverage ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span className="hidden lg:inline">Pokryti</span>
      </button>

      <button
        onClick={onToggleZones}
        title="Zobrazit zony"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
          showZones ? 'bg-amber-600/20 text-amber-400 ring-1 ring-amber-500/30' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="12" rx="2" strokeDasharray="3 2" />
        </svg>
        <span className="hidden lg:inline">Zony</span>
      </button>
    </div>
  );
}
