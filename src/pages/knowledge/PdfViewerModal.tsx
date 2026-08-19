import { useState, useEffect, useCallback } from 'react';
import { X, Download, Maximize2, Minimize2, ExternalLink, FileText, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
}

export default function PdfViewerModal({ url, title, onClose }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    let cancelled = false;
    const fetchPdf = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError('Nepodařilo se načíst PDF soubor.');
        setLoading(false);
      }
    };
    fetchPdf();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-navy-800/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          fullscreen ? 'fixed inset-2 w-auto h-auto' : 'w-[90vw] max-w-5xl h-[85vh]'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.04]/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-red-500" />
            </div>
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition"
              title="Otevřít v novém okně"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href={url}
              download
              className="p-2 rounded-lg hover:bg-blue-500/100/10 text-slate-400 hover:text-blue-400 transition"
              title="Stáhnout"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={() => setFullscreen(f => !f)}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-400 transition"
              title={fullscreen ? 'Zmenšit' : 'Celá obrazovka'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-500/100/10 text-slate-400 hover:text-red-500 transition"
              title="Zavřít"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white/[0.08] min-h-0 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/[0.06] z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-slate-500">Načítám PDF...</span>
              </div>
            </div>
          )}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
              <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-amber-500" />
                </div>
                <p className="text-sm font-medium text-slate-300">{error}</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  Otevřít v novém okně
                </a>
              </div>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={title}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
