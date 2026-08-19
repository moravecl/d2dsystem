import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Lock, MapPin, Move } from 'lucide-react';
import { metersPerPixelAtZoom } from './CameraCanvas';

const TILE_SIZE = 256;

function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

function tileXToLon(x: number, zoom: number) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

interface Props {
  lat: number;
  lon: number;
  name: string;
  onConfirm: (zoom: number, lat: number, lon: number) => void;
  onCancel: () => void;
}

const ZOOM_LABELS: Record<number, string> = {
  15: 'Oblast (~5 m/px)',
  16: 'Ulice (~2.5 m/px)',
  17: 'Blok (~1.2 m/px)',
  18: 'Budova (~0.6 m/px)',
  19: 'Detail (~0.3 m/px)',
  20: 'Max (~0.15 m/px)',
};

export default function MapSetupModal({ lat, lon, name, onConfirm, onCancel }: Props) {
  const [zoom, setZoom] = useState(19);
  const [centerTileX, setCenterTileX] = useState(() => lonToTileX(lon, 19));
  const [centerTileY, setCenterTileY] = useState(() => latToTileY(lat, 19));
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  const panStartRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    const curLon = tileXToLon(centerTileX, zoom);
    const curLat = tileYToLat(centerTileY, zoom);
    setCenterTileX(lonToTileX(curLon, newZoom));
    setCenterTileY(latToTileY(curLat, newZoom));
    setZoom(newZoom);
  }, [centerTileX, centerTileY, zoom]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = (e.clientX - panStartRef.current.x) / TILE_SIZE;
      const dy = (e.clientY - panStartRef.current.y) / TILE_SIZE;
      setCenterTileX(panStartRef.current.cx - dx);
      setCenterTileY(panStartRef.current.cy - dy);
    };
    const onUp = () => {
      panStartRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handlePanStart = (e: React.MouseEvent) => {
    e.preventDefault();
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cx: centerTileX,
      cy: centerTileY,
    };
    setIsPanning(true);
  };

  const tiles = (() => {
    const halfW = size.w / 2;
    const halfH = size.h / 2;
    const startTX = Math.floor(centerTileX - halfW / TILE_SIZE);
    const endTX = Math.ceil(centerTileX + halfW / TILE_SIZE);
    const startTY = Math.floor(centerTileY - halfH / TILE_SIZE);
    const endTY = Math.ceil(centerTileY + halfH / TILE_SIZE);
    const result: { tx: number; ty: number; x: number; y: number }[] = [];
    const maxT = Math.pow(2, zoom);
    for (let tx = startTX; tx <= endTX; tx++) {
      for (let ty = startTY; ty <= endTY; ty++) {
        if (ty < 0 || ty >= maxT) continue;
        const wrappedTx = ((tx % maxT) + maxT) % maxT;
        result.push({
          tx: wrappedTx, ty,
          x: (tx - centerTileX) * TILE_SIZE + size.w / 2,
          y: (ty - centerTileY) * TILE_SIZE + size.h / 2,
        });
      }
    }
    return result;
  })();

  const currentLat = tileYToLat(centerTileY, zoom);
  const mpp = metersPerPixelAtZoom(currentLat, zoom);

  const scaleBarInfo = (() => {
    const ppm = 1 / mpp;
    const targetPx = 100;
    const rawMeters = targetPx / ppm;
    const niceSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    let best = niceSteps[0];
    for (const s of niceSteps) {
      if (s <= rawMeters * 1.5) best = s;
    }
    return { meters: best, pixels: best * ppm };
  })();

  const handleConfirm = () => {
    const finalLat = tileYToLat(centerTileY, zoom);
    const finalLon = tileXToLon(centerTileX, zoom);
    onConfirm(zoom, finalLat, finalLon);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-white">{name}</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-700/30 flex items-center gap-4">
          <span className="text-xs font-bold text-slate-400 uppercase">Priblizeni</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleZoomChange(Math.max(15, zoom - 1))}
              disabled={zoom <= 15}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-30 transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="flex gap-0.5">
              {[15, 16, 17, 18, 19, 20].map(z => (
                <button
                  key={z}
                  onClick={() => handleZoomChange(z)}
                  className={`w-10 h-8 rounded-lg text-xs font-bold transition ${
                    zoom === z
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleZoomChange(Math.min(20, zoom + 1))}
              disabled={zoom >= 20}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-30 transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs text-slate-500 ml-auto">
            {ZOOM_LABELS[zoom] || `${mpp.toFixed(2)} m/px`}
          </span>
        </div>

        <div
          ref={containerRef}
          className="relative w-full flex-1 min-h-[400px] overflow-hidden bg-slate-800 select-none"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onMouseDown={handlePanStart}
        >
          {tiles.map(t => (
            <img
              key={`${zoom}-${t.tx}-${t.ty}`}
              src={`https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/${zoom}/${t.ty}/${t.tx}`}
              alt=""
              className="absolute pointer-events-none"
              style={{ left: Math.round(t.x), top: Math.round(t.y), width: TILE_SIZE, height: TILE_SIZE }}
              draggable={false}
            />
          ))}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-8 bg-white/[0.06] rounded-full absolute" />
            <div className="h-1.5 w-8 bg-white/[0.06] rounded-full absolute" />
          </div>

          <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 pointer-events-none">
            <Move className="w-3.5 h-3.5 text-white/70" />
            <span className="text-[10px] text-white/70 font-bold">Tahnete pro posun</span>
          </div>

          <div className="absolute bottom-3 left-3">
            <div className="flex items-end gap-1">
              <div
                className="h-2 border-l-2 border-r-2 border-b-2 border-white/80"
                style={{ width: scaleBarInfo.pixels }}
              />
            </div>
            <div className="text-[10px] text-white/80 font-bold mt-0.5 drop-shadow-lg">
              {scaleBarInfo.meters} m
            </div>
          </div>

          <div className="absolute bottom-1 right-1 text-[9px] text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
            CUZK Ortofoto
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="text-xs text-slate-400">
            <span className="font-bold text-slate-300">{mpp.toFixed(2)} m/px</span>
            <span className="mx-2">|</span>
            Posunete mapu a pak zamknete
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition">
              Zrusit
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
            >
              <Lock className="w-3.5 h-3.5" /> Potvrdit a zamknout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
