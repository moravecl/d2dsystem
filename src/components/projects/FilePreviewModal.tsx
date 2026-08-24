import { useState, useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Maximize2, FileText, Loader2, ExternalLink } from 'lucide-react';

interface PreviewFile {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

interface FilePreviewModalProps {
  file: PreviewFile | null;
  files?: PreviewFile[];
  onClose: () => void;
  onNavigate?: (file: PreviewFile) => void;
}

const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const PDF_TYPES = ['pdf'];
const VIDEO_TYPES = ['mp4', 'webm', 'ogg', 'mov'];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilePreviewModal({ file, files = [], onClose, onNavigate }: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const ext = file?.file_type?.toLowerCase() || '';
  const isPdfFile = PDF_TYPES.includes(ext);

  useEffect(() => {
    if (!file || !isPdfFile) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(false);
    setPdfBlobUrl(null);

    fetch(file.file_url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (cancelled) return;
        setPdfBlobUrl(URL.createObjectURL(blob));
        setPdfLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPdfError(true);
        setPdfLoading(false);
      });

    return () => {
      cancelled = true;
      setPdfBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [file?.id]);

  if (!file) return null;
  const isImage = IMAGE_TYPES.includes(ext);
  const isVideo = VIDEO_TYPES.includes(ext);
  const canPreview = isImage || isPdfFile || isVideo;

  const currentIndex = files.findIndex(f => f.id === file.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < files.length - 1 && currentIndex >= 0;

  const handlePrev = () => {
    if (hasPrev && onNavigate) {
      setZoom(1);
      setRotation(0);
      onNavigate(files[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      setZoom(1);
      setRotation(0);
      onNavigate(files[currentIndex + 1]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{file.name}</div>
          <span className="text-[10px] text-slate-400 shrink-0">
            {ext.toUpperCase()} &middot; {formatSize(file.file_size)}
            {files.length > 1 && ` &middot; ${currentIndex + 1} / ${files.length}`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isImage && (
            <>
              <button
                onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Oddalit"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(5, z + 0.25))}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Přiblížit"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Otočit"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setZoom(1); setRotation(0); }}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Resetovat"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-white/10 mx-1" />
            </>
          )}
          <a
            href={file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Stáhnout"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {hasPrev && (
          <button
            onClick={handlePrev}
            className="absolute left-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition backdrop-blur-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {isImage && (
          <div className="relative z-10 flex items-center justify-center w-full h-full p-8 overflow-auto">
            <img
              src={file.file_url}
              alt={file.name}
              className="max-w-none transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                maxHeight: zoom === 1 ? '80vh' : undefined,
                maxWidth: zoom === 1 ? '90vw' : undefined,
              }}
              draggable={false}
            />
          </div>
        )}

        {isPdfFile && (
          <div className="relative z-10 w-full h-full flex flex-col bg-white/[0.06]">
            {pdfLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-sm text-slate-500">Načítám PDF...</span>
                </div>
              </div>
            )}
            {pdfError && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <FileText className="w-16 h-16 text-slate-300" />
                <p className="text-sm font-semibold text-slate-400">PDF nelze zobrazit</p>
                <div className="flex items-center gap-3">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
                  >
                    <ExternalLink className="w-4 h-4" /> Otevřít v nové záložce
                  </a>
                  <a
                    href={file.file_url}
                    download={file.name}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.08] rounded-xl transition"
                  >
                    <Download className="w-4 h-4" /> Stáhnout
                  </a>
                </div>
              </div>
            )}
            {pdfBlobUrl && (
              <iframe
                src={pdfBlobUrl}
                className="w-full flex-1 border-0"
                title={file.name}
              />
            )}
          </div>
        )}

        {isVideo && (
          <video
            src={file.file_url}
            controls
            className="relative z-10 max-w-[90vw] max-h-[80vh] rounded-lg"
          />
        )}

        {!canPreview && (
          <div className="relative z-10 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-white/50" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">Náhled není k dispozici</p>
            <p className="text-xs text-slate-400 mb-4">
              Soubor typu {ext.toUpperCase()} nelze zobrazit v prohlížeči
            </p>
            <a
              href={file.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
            >
              <Download className="w-4 h-4" /> Stáhnout soubor
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
