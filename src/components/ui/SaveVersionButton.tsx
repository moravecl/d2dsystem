import { useState, useRef, useEffect } from 'react';
import { Save, ChevronDown, History, Loader2, Plus } from 'lucide-react';

interface Props {
  onSave: () => void;
  onOpenVersions: () => void;
  onSaveAsNewVersion?: () => void;
  saving?: boolean;
  disabled?: boolean;
  versionCount?: number;
  variant?: 'light' | 'dark';
}

export default function SaveVersionButton({
  onSave,
  onOpenVersions,
  onSaveAsNewVersion,
  saving,
  disabled,
  versionCount = 0,
  variant = 'light',
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const isDark = variant === 'dark';

  return (
    <div ref={ref} className="relative flex items-stretch">
      <button
        onClick={onSave}
        disabled={disabled || saving}
        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition rounded-l-lg disabled:opacity-50 ${
          isDark
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
        }`}
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Uložit
      </button>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`flex items-center px-1.5 py-2 transition rounded-r-lg border-l ${
          isDark
            ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-500'
            : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08] border-white/10'
        }`}
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {dropdownOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-navy-800/60 rounded-xl shadow-xl border border-white/10 overflow-hidden z-50">
          {onSaveAsNewVersion && (
            <button
              onClick={() => { setDropdownOpen(false); onSaveAsNewVersion(); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-extrabold text-slate-300 hover:bg-blue-500/10 transition text-left border-b border-white/[0.06]"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500" />
              Uložit jako novou verzi
            </button>
          )}
          <button
            onClick={() => { setDropdownOpen(false); onOpenVersions(); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-extrabold text-slate-300 hover:bg-white/[0.04] transition text-left"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            Historie verzí
            {versionCount > 0 && (
              <span className="ml-auto text-[10px] font-extrabold bg-white/[0.06] text-slate-500 px-1.5 py-0.5 rounded-full">
                {versionCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
