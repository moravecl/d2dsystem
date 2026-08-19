import { useEffect, ReactNode } from 'react';
import { X, Plus, History, FileText, Calendar, Layers } from 'lucide-react';

export interface VersionPickerVersion {
  id: string;
  version_number: number;
  note?: string;
  label?: string;
  created_at: string;
}

interface VersionPickerModalProps<T extends VersionPickerVersion> {
  open: boolean;
  onClose: () => void;
  versions: T[];
  loading: boolean;
  onSelectVersion: (version: T) => void;
  onStartNew: () => void;
  title: string;
  variant?: 'design' | 'fv' | 'camera';
  renderSummary?: (version: T) => ReactNode;
}

export default function VersionPickerModal<T extends VersionPickerVersion>({
  open,
  onClose,
  versions,
  loading,
  onSelectVersion,
  onStartNew,
  title,
  variant = 'design',
  renderSummary,
}: VersionPickerModalProps<T>) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const accentColors = {
    design: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      button: 'bg-blue-600 hover:bg-blue-700',
      ring: 'ring-blue-500/20',
    },
    fv: {
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      button: 'bg-orange-600 hover:bg-orange-700',
      ring: 'ring-orange-500/20',
    },
    camera: {
      bg: 'bg-sky-500/20',
      text: 'text-sky-400',
      border: 'border-sky-500/30',
      button: 'bg-sky-600 hover:bg-sky-700',
      ring: 'ring-sky-500/20',
    },
  };

  const colors = accentColors[variant];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-backdrop-enter" onClick={onClose} />
      <div className="min-h-full flex items-center justify-center py-6 sm:py-10 px-4">
        <div className="relative glass-modal w-full max-w-xl animate-modal-enter flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                <Layers className={`w-5 h-5 ${colors.text}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <p className="text-xs text-slate-400">
                  {versions.length > 0 ? `${versions.length} uložených verzí` : 'Žádné uložené verze'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 overflow-y-auto flex-1">
            <button
              onClick={() => {
                onStartNew();
                onClose();
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-xl ${colors.button} text-white font-semibold transition mb-5 shadow-lg`}
            >
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">Začít novou konfiguraci</div>
                <div className="text-xs opacity-80">Vytvořit nový návrh od začátku</div>
              </div>
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8">
                <div className={`w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center mx-auto mb-4`}>
                  <History className={`w-8 h-8 ${colors.text}`} />
                </div>
                <p className="text-slate-400 text-sm">Zatím nemáte žádné uložené verze.</p>
                <p className="text-slate-500 text-xs mt-1">Začněte novou konfiguraci a uložte verzi.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Historie verzí
                  </span>
                </div>
                {versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => {
                      onSelectVersion(version);
                      onClose();
                    }}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.12] transition group text-left`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-sm font-bold ${colors.text}`}>V{version.version_number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">
                          {version.note || version.label || `Verze ${version.version_number}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(version.created_at)}</span>
                      </div>
                      {renderSummary && (
                        <div className="mt-2">
                          {renderSummary(version)}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition">
                      <FileText className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] rounded-b-2xl shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
