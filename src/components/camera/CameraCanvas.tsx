import { useState, useRef, useCallback, useEffect } from 'react';
import type { CameraModel } from '../../hooks/useCameraCatalog';
import type { PlacedCamera, CableRoute, PlacedNvr, PlacedSwitch, DesignLayer } from '../../hooks/useCameraDesign';

const TILE_SIZE = 256;
const CAMERA_TYPE_COLORS: Record<string, string> = {
  dome: '#3b82f6', bullet: '#10b981', ptz: '#f59e0b', fisheye: '#ec4899', box: '#8b5cf6',
};

function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

export function metersPerPixelAtZoom(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom);
}

interface ViewState { centerX: number; centerY: number; zoom: number; }

export type CanvasMode = 'navigate' | 'place_camera' | 'draw_route' | 'place_nvr' | 'place_switch' | 'measure' | 'set_scale';

interface Props {
  layer: DesignLayer | null;
  cameras: PlacedCamera[];
  routes: CableRoute[];
  nvrs: PlacedNvr[];
  switches: PlacedSwitch[];
  cameraModels: CameraModel[];
  mode: CanvasMode;
  selectedCameraModelId: string | null;
  selectedCableTypeId: string | null;
  selectedNvrId: string | null;
  selectedSwitchId: string | null;
  selectedPlacedCameraId: string | null;
  selectedPlacedNvrId: string | null;
  selectedPlacedSwitchId: string | null;
  scale?: { p1: { x: number; y: number }; p2: { x: number; y: number }; realDistanceM: number };
  mapScale?: { metersPerPixel: number };
  onPlaceCamera: (x: number, y: number) => void;
  onUpdateCameraRotation: (id: string, deg: number) => void;
  onMoveCamera: (id: string, x: number, y: number) => void;
  onMoveNvr: (id: string, x: number, y: number) => void;
  onMoveSwitch: (id: string, x: number, y: number) => void;
  onSelectPlacedCamera: (id: string | null) => void;
  onSelectPlacedNvr: (id: string | null) => void;
  onSelectPlacedSwitch: (id: string | null) => void;
  onDeletePlacedNvr: (id: string) => void;
  onDeletePlacedSwitch: (id: string) => void;
  onAddRoutePoint: (x: number, y: number) => void;
  onFinishRoute: () => void;
  onPlaceNvr: (x: number, y: number) => void;
  onPlaceSwitch: (x: number, y: number) => void;
  onScalePoint: (x: number, y: number) => void;
  drawingRoute: { x: number; y: number }[];
  scalePoints: { x: number; y: number }[];
  showIrRange: boolean;
  showFov: boolean;
  onCanvasAspect?: (aspect: number, w: number, h: number) => void;
}

export default function CameraCanvas({
  layer, cameras, routes, nvrs, switches, cameraModels, mode,
  selectedCameraModelId, selectedPlacedCameraId, selectedPlacedNvrId, selectedPlacedSwitchId,
  scale, onPlaceCamera, onUpdateCameraRotation, onMoveCamera, onMoveNvr, onMoveSwitch,
  onSelectPlacedCamera, onSelectPlacedNvr, onSelectPlacedSwitch, onDeletePlacedNvr, onDeletePlacedSwitch,
  onAddRoutePoint, onFinishRoute, onPlaceNvr, onPlaceSwitch, onScalePoint,
  drawingRoute, scalePoints, showIrRange, showFov, onCanvasAspect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<ViewState>({ centerX: lonToTileX(14.4378, 18), centerY: latToTileY(50.0755, 18), zoom: 18 });
  const [, setRotatingCam] = useState<string | null>(null);
  const rotatingRef = useRef<string | null>(null);
  const draggingRef = useRef<{ type: 'camera' | 'nvr' | 'switch'; id: string } | null>(null);
  const [, setDraggingCam] = useState<string | null>(null);
  const isMap = layer?.type === 'map';

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) {
        const w = e.contentRect.width;
        const h = e.contentRect.height;
        setContainerSize({ w, h });
        if (h > 0 && onCanvasAspect) onCanvasAspect(w / h, w, h);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [onCanvasAspect]);

  useEffect(() => {
    if (layer?.type === 'map' && layer.mapCenter && layer.mapZoom) {
      setView({
        centerX: lonToTileX(layer.mapCenter.lon, layer.mapZoom),
        centerY: latToTileY(layer.mapCenter.lat, layer.mapZoom),
        zoom: layer.mapZoom,
      });
    }
  }, [layer]);

  const getNormalized = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0.5, y: 0.5 };
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rotId = rotatingRef.current;
      const drag = draggingRef.current;
      if (!rotId && !drag) return;
      const pt = getNormalized(e);

      if (rotId) {
        const cam = cameras.find(c => c.id === rotId);
        if (cam) {
          const angle = Math.atan2(pt.y - cam.y, pt.x - cam.x) * (180 / Math.PI);
          onUpdateCameraRotation(rotId, angle);
        }
      }

      if (drag) {
        if (drag.type === 'camera') onMoveCamera(drag.id, pt.x, pt.y);
        else if (drag.type === 'nvr') onMoveNvr(drag.id, pt.x, pt.y);
        else if (drag.type === 'switch') onMoveSwitch(drag.id, pt.x, pt.y);
      }
    };
    const onUp = () => {
      rotatingRef.current = null;
      setRotatingCam(null);
      draggingRef.current = null;
      setDraggingCam(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cameras, getNormalized, onUpdateCameraRotation, onMoveCamera, onMoveNvr, onMoveSwitch]);

  const startRotation = useCallback((camId: string) => {
    rotatingRef.current = camId;
    setRotatingCam(camId);
    onSelectPlacedCamera(camId);
  }, [onSelectPlacedCamera]);

  const startDragging = useCallback((type: 'camera' | 'nvr' | 'switch', id: string) => {
    draggingRef.current = { type, id };
    if (type === 'camera') { setDraggingCam(id); onSelectPlacedCamera(id); onSelectPlacedNvr(null); onSelectPlacedSwitch(null); }
    else if (type === 'nvr') { onSelectPlacedNvr(id); onSelectPlacedCamera(null); onSelectPlacedSwitch(null); }
    else if (type === 'switch') { onSelectPlacedSwitch(id); onSelectPlacedCamera(null); onSelectPlacedNvr(null); }
  }, [onSelectPlacedCamera, onSelectPlacedNvr, onSelectPlacedSwitch]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (rotatingRef.current || draggingRef.current) return;
    const pt = getNormalized(e);
    if (mode === 'place_camera' && selectedCameraModelId) {
      onPlaceCamera(pt.x, pt.y);
    } else if (mode === 'draw_route') {
      onAddRoutePoint(pt.x, pt.y);
    } else if (mode === 'place_nvr') {
      onPlaceNvr(pt.x, pt.y);
    } else if (mode === 'place_switch') {
      onPlaceSwitch(pt.x, pt.y);
    } else if (mode === 'set_scale') {
      onScalePoint(pt.x, pt.y);
    } else if (mode === 'navigate') {
      const clickedCam = cameras.find(c => {
        const dx = c.x - pt.x;
        const dy = c.y - pt.y;
        return Math.sqrt(dx * dx + dy * dy) < 0.02;
      });
      onSelectPlacedCamera(clickedCam?.id ?? null);
    }
  }, [mode, selectedCameraModelId, cameras, getNormalized, onPlaceCamera, onAddRoutePoint, onPlaceNvr, onPlaceSwitch, onScalePoint, onSelectPlacedCamera]);

  const handleDoubleClick = useCallback(() => {
    if (mode === 'draw_route' && drawingRoute.length >= 2) {
      onFinishRoute();
    }
  }, [mode, drawingRoute.length, onFinishRoute]);

  const tilesNeeded = () => {
    if (!isMap) return [];
    const halfW = containerSize.w / 2;
    const halfH = containerSize.h / 2;
    const startTX = Math.floor(view.centerX - halfW / TILE_SIZE);
    const endTX = Math.ceil(view.centerX + halfW / TILE_SIZE);
    const startTY = Math.floor(view.centerY - halfH / TILE_SIZE);
    const endTY = Math.ceil(view.centerY + halfH / TILE_SIZE);
    const tiles: { tx: number; ty: number; x: number; y: number }[] = [];
    const maxT = Math.pow(2, view.zoom);
    for (let tx = startTX; tx <= endTX; tx++) {
      for (let ty = startTY; ty <= endTY; ty++) {
        if (ty < 0 || ty >= maxT) continue;
        const wrappedTx = ((tx % maxT) + maxT) % maxT;
        tiles.push({
          tx: wrappedTx, ty,
          x: (tx - view.centerX) * TILE_SIZE + containerSize.w / 2,
          y: (ty - view.centerY) * TILE_SIZE + containerSize.h / 2,
        });
      }
    }
    return tiles;
  };

  const getPixelsPerMeter = (): number => {
    if (isMap && layer?.mapCenter && layer?.mapZoom) {
      const mpp = metersPerPixelAtZoom(layer.mapCenter.lat, layer.mapZoom);
      return 1 / mpp;
    }
    if (scale) {
      const dx = (scale.p2.x - scale.p1.x) * containerSize.w;
      const dy = (scale.p2.y - scale.p1.y) * containerSize.h;
      const pxDist = Math.sqrt(dx * dx + dy * dy);
      return pxDist / scale.realDistanceM;
    }
    return 2;
  };

  const getNormPixelsPerMeter = (): number => {
    if (isMap && layer?.mapCenter && layer?.mapZoom) {
      const mpp = metersPerPixelAtZoom(layer.mapCenter.lat, layer.mapZoom);
      return 1 / (mpp * containerSize.w);
    }
    if (scale) {
      const dx = scale.p2.x - scale.p1.x;
      const dy = scale.p2.y - scale.p1.y;
      const normDist = Math.sqrt(dx * dx + dy * dy);
      return normDist / scale.realDistanceM;
    }
    return 0.002;
  };

  const toAbs = (nx: number, ny: number) => ({
    x: nx * containerSize.w,
    y: ny * containerSize.h,
  });

  const fovRadius = (model: CameraModel) => {
    const nppm = getNormPixelsPerMeter();
    const rangeM = Math.min(model.ir_range_m, 60);
    return rangeM * nppm * containerSize.w;
  };

  const cursorStyle = (() => {
    if (mode === 'navigate') return 'default';
    if (mode === 'place_camera' || mode === 'place_nvr' || mode === 'place_switch') return 'crosshair';
    if (mode === 'draw_route') return 'crosshair';
    if (mode === 'set_scale') return 'crosshair';
    return 'default';
  })();

  const tiles = tilesNeeded();

  const scaleBarMeters = (() => {
    const ppm = getPixelsPerMeter();
    if (ppm <= 0) return null;
    const targetPx = 120;
    const rawMeters = targetPx / ppm;
    const niceSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    let best = niceSteps[0];
    for (const s of niceSteps) {
      if (s <= rawMeters * 1.5) best = s;
    }
    return { meters: best, pixels: best * ppm };
  })();

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-800 select-none"
      style={{ cursor: cursorStyle }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {isMap && tiles.map(t => (
        <img
          key={`${view.zoom}-${t.tx}-${t.ty}`}
          src={`https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/${view.zoom}/${t.ty}/${t.tx}`}
          alt=""
          className="absolute pointer-events-none"
          style={{ left: Math.round(t.x), top: Math.round(t.y), width: TILE_SIZE, height: TILE_SIZE }}
          draggable={false}
        />
      ))}

      {!isMap && layer?.imageData && (
        <img
          src={layer.imageData}
          alt="Podklad"
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
      )}

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${containerSize.w} ${containerSize.h}`}
      >
        {routes.map(route => {
          if (route.points.length < 2) return null;
          const pts = route.points.map(p => toAbs(p.x, p.y));
          const routeColor = route.label ? stringToColor(route.label) : '#f59e0b';
          return (
            <g key={route.id}>
              <polyline
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={routeColor}
                strokeWidth="3"
                strokeDasharray="8 4"
                opacity={0.8}
              />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={routeColor} />
              ))}
              {route.label && pts.length >= 2 && (
                <text
                  x={(pts[0].x + pts[Math.floor(pts.length / 2)].x) / 2}
                  y={(pts[0].y + pts[Math.floor(pts.length / 2)].y) / 2 - 8}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="bold"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                >
                  {route.label}
                </text>
              )}
            </g>
          );
        })}

        {drawingRoute.length > 0 && (
          <polyline
            points={drawingRoute.map(p => { const a = toAbs(p.x, p.y); return `${a.x},${a.y}`; }).join(' ')}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeDasharray="4 4"
            opacity={0.6}
          />
        )}

        {cameras.map(cam => {
          const model = cameraModels.find(m => m.id === cam.modelId);
          if (!model) return null;
          const abs = toAbs(cam.x, cam.y);
          const color = CAMERA_TYPE_COLORS[model.camera_type] ?? '#3b82f6';
          const halfFov = (model.h_fov_deg / 2) * (Math.PI / 180);
          const rotRad = cam.rotationDeg * (Math.PI / 180);
          const fovR = fovRadius(model);
          const isSelected = cam.id === selectedPlacedCameraId;

          return (
            <g key={cam.id}>
              {showIrRange && (
                <g>
                  <circle
                    cx={abs.x} cy={abs.y}
                    r={fovR}
                    fill={color}
                    fillOpacity={isSelected ? 0.08 : 0.04}
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeDasharray="8 4"
                    strokeOpacity={isSelected ? 0.7 : 0.45}
                  />
                  <text
                    x={abs.x}
                    y={abs.y - fovR - 6}
                    textAnchor="middle"
                    fill={color}
                    fontSize="11"
                    fontWeight="bold"
                    opacity={0.85}
                    style={{ textShadow: '0 1px 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.7)' }}
                  >
                    IR {model.ir_range_m}m
                  </text>
                </g>
              )}

              {showFov && (
                <path
                  d={`M ${abs.x} ${abs.y}
                      L ${abs.x + Math.cos(rotRad - halfFov) * fovR} ${abs.y + Math.sin(rotRad - halfFov) * fovR}
                      A ${fovR} ${fovR} 0 ${model.h_fov_deg > 180 ? 1 : 0} 1 ${abs.x + Math.cos(rotRad + halfFov) * fovR} ${abs.y + Math.sin(rotRad + halfFov) * fovR}
                      Z`}
                  fill={color}
                  opacity={isSelected ? 0.25 : 0.12}
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeOpacity={0.5}
                />
              )}

              <circle
                cx={abs.x} cy={abs.y} r={isSelected ? 14 : 10}
                fill={color}
                stroke="white"
                strokeWidth={isSelected ? 3 : 2}
                className="pointer-events-auto cursor-move"
                style={{ filter: isSelected ? 'drop-shadow(0 0 8px rgba(0,0,0,0.4))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startDragging('camera', cam.id);
                }}
              />

              <text
                x={abs.x} y={abs.y + (isSelected ? 5 : 4)}
                textAnchor="middle"
                fill="white"
                fontSize={isSelected ? '11' : '9'}
                fontWeight="bold"
                className="pointer-events-none"
              >
                {(cam.label || '').replace(/^CAM\s*/i, '')}
              </text>

              <circle
                cx={abs.x + Math.cos(rotRad) * (isSelected ? 22 : 18)}
                cy={abs.y + Math.sin(rotRad) * (isSelected ? 22 : 18)}
                r={6}
                fill="white"
                stroke={color}
                strokeWidth={2}
                className="pointer-events-auto cursor-grab"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startRotation(cam.id);
                }}
              />

              <text
                x={abs.x} y={abs.y - 18}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
              >
                {cam.label || model.name}
              </text>
            </g>
          );
        })}

        {nvrs.map(nvr => {
          const abs = toAbs(nvr.x, nvr.y);
          const isSelected = nvr.id === selectedPlacedNvrId;
          return (
            <g key={nvr.id}>
              {isSelected && (
                <rect
                  x={abs.x - 20} y={abs.y - 16}
                  width={40} height={32}
                  rx={6}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  opacity={0.7}
                />
              )}
              <rect
                x={abs.x - 16} y={abs.y - 12}
                width={32} height={24}
                rx={4}
                fill={isSelected ? '#1e3a5f' : '#1e293b'}
                stroke="#60a5fa"
                strokeWidth={isSelected ? 3 : 2}
                className="pointer-events-auto cursor-move"
                style={{ filter: isSelected ? 'drop-shadow(0 0 8px rgba(96,165,250,0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startDragging('nvr', nvr.id);
                }}
              />
              <text x={abs.x} y={abs.y + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" className="pointer-events-none">NVR</text>
              <text x={abs.x} y={abs.y - 18} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold"
                className="pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>NVR</text>
              {isSelected && (
                <g
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeletePlacedNvr(nvr.id); }}
                >
                  <circle cx={abs.x + 20} cy={abs.y - 16} r={8} fill="#ef4444" stroke="white" strokeWidth={1.5} />
                  <text x={abs.x + 20} y={abs.y - 12} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">×</text>
                </g>
              )}
            </g>
          );
        })}

        {switches.map(sw => {
          const abs = toAbs(sw.x, sw.y);
          const isSelected = sw.id === selectedPlacedSwitchId;
          return (
            <g key={sw.id}>
              {isSelected && (
                <rect
                  x={abs.x - 18} y={abs.y - 14}
                  width={36} height={28}
                  rx={5}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  opacity={0.7}
                />
              )}
              <rect
                x={abs.x - 14} y={abs.y - 10}
                width={28} height={20}
                rx={3}
                fill={isSelected ? '#0a2e1f' : '#1e293b'}
                stroke="#10b981"
                strokeWidth={isSelected ? 3 : 2}
                className="pointer-events-auto cursor-move"
                style={{ filter: isSelected ? 'drop-shadow(0 0 8px rgba(16,185,129,0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startDragging('switch', sw.id);
                }}
              />
              <text x={abs.x} y={abs.y + 3} textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="bold" className="pointer-events-none">SW</text>
              {isSelected && (
                <g
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeletePlacedSwitch(sw.id); }}
                >
                  <circle cx={abs.x + 18} cy={abs.y - 14} r={8} fill="#ef4444" stroke="white" strokeWidth={1.5} />
                  <text x={abs.x + 18} y={abs.y - 10} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">×</text>
                </g>
              )}
            </g>
          );
        })}

        {scalePoints.length >= 1 && (
          <g>
            {scalePoints.map((p, i) => {
              const abs = toAbs(p.x, p.y);
              return <circle key={i} cx={abs.x} cy={abs.y} r={6} fill="#ef4444" stroke="white" strokeWidth={2} />;
            })}
            {scalePoints.length === 2 && (
              <line
                x1={toAbs(scalePoints[0].x, scalePoints[0].y).x}
                y1={toAbs(scalePoints[0].x, scalePoints[0].y).y}
                x2={toAbs(scalePoints[1].x, scalePoints[1].y).x}
                y2={toAbs(scalePoints[1].x, scalePoints[1].y).y}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            )}
          </g>
        )}

        {scale && !isMap && (
          <g>
            <line
              x1={scale.p1.x * containerSize.w} y1={scale.p1.y * containerSize.h}
              x2={scale.p2.x * containerSize.w} y2={scale.p2.y * containerSize.h}
              stroke="#22c55e" strokeWidth={2} strokeDasharray="4 3"
            />
            <text
              x={(scale.p1.x + scale.p2.x) / 2 * containerSize.w}
              y={(scale.p1.y + scale.p2.y) / 2 * containerSize.h - 8}
              textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
            >
              {scale.realDistanceM.toFixed(1)} m
            </text>
          </g>
        )}
      </svg>

      {(isMap || scale) && scaleBarMeters && (
        <div className="absolute bottom-3 left-3 z-20">
          <div className="flex items-end gap-1">
            <div
              className="h-2 border-l-2 border-r-2 border-b-2 border-white/80"
              style={{ width: scaleBarMeters.pixels }}
            />
          </div>
          <div className="text-[10px] text-white/80 font-bold mt-0.5 drop-shadow-lg">
            {scaleBarMeters.meters} m
          </div>
        </div>
      )}

      {isMap && (
        <div className="absolute bottom-1 right-1 z-20 text-[9px] text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
          CUZK Ortofoto
        </div>
      )}
    </div>
  );
}

function stringToColor(str: string): string {
  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
