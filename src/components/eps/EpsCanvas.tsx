import { useState, useRef, useCallback, useEffect } from 'react';
import type { EpsDetectorModel, EpsMotionSensor, EpsKeypad, EpsControlDevice } from '../../hooks/useEpsCatalog';
import type { PlacedDetector, EpsCableRoute, PlacedPanel, PlacedSiren, PlacedMotionSensor, PlacedKeypad, PlacedControlDevice, EpsDesignLayer, EpsZone } from '../../hooks/useEpsDesign';
import type { EpsCanvasMode } from './EpsToolbar';

const DETECTOR_TYPE_COLORS: Record<string, string> = {
  smoke: '#3b82f6',
  heat: '#ef4444',
  smoke_heat: '#10b981',
  linear: '#8b5cf6',
  manual_call_point: '#f59e0b',
  gas: '#ec4899',
  co: '#06b6d4',
  flame: '#f97316',
};

const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type DragTarget = { type: 'detector' | 'panel' | 'siren' | 'motionSensor' | 'keypad' | 'controlDevice'; id: string };

interface Props {
  layer: EpsDesignLayer | null;
  detectors: PlacedDetector[];
  routes: EpsCableRoute[];
  panels: PlacedPanel[];
  sirens: PlacedSiren[];
  motionSensors: PlacedMotionSensor[];
  keypads: PlacedKeypad[];
  controlDevices: PlacedControlDevice[];
  detectorModels: EpsDetectorModel[];
  motionSensorModels: EpsMotionSensor[];
  keypadModels: EpsKeypad[];
  controlDeviceModels: EpsControlDevice[];
  zones: EpsZone[];
  mode: EpsCanvasMode;
  selectedDetectorModelId: string | null;
  selectedCableTypeId: string | null;
  selectedPanelId: string | null;
  selectedSirenId: string | null;
  selectedMotionSensorId: string | null;
  selectedKeypadId: string | null;
  selectedControlDeviceId: string | null;
  selectedPlacedDetectorId: string | null;
  selectedPlacedMotionSensorId: string | null;
  scale?: { p1: { x: number; y: number }; p2: { x: number; y: number }; realDistanceM: number };
  onPlaceDetector: (x: number, y: number) => void;
  onMoveDetector: (id: string, x: number, y: number) => void;
  onMovePanel: (id: string, x: number, y: number) => void;
  onMoveSiren: (id: string, x: number, y: number) => void;
  onMoveMotionSensor: (id: string, x: number, y: number) => void;
  onMoveKeypad: (id: string, x: number, y: number) => void;
  onMoveControlDevice: (id: string, x: number, y: number) => void;
  onSelectPlacedDetector: (id: string | null) => void;
  onSelectPlacedMotionSensor: (id: string | null) => void;
  onRotateMotionSensor: (id: string, deg: number) => void;
  onAddRoutePoint: (x: number, y: number) => void;
  onFinishRoute: () => void;
  onPlacePanel: (x: number, y: number) => void;
  onPlaceSiren: (x: number, y: number) => void;
  onPlaceMotionSensor: (x: number, y: number) => void;
  onPlaceKeypad: (x: number, y: number) => void;
  onPlaceControlDevice: (x: number, y: number) => void;
  onScalePoint: (x: number, y: number) => void;
  drawingRoute: { x: number; y: number }[];
  scalePoints: { x: number; y: number }[];
  showCoverage: boolean;
  showZones: boolean;
  scaleLocked: boolean;
}

export default function EpsCanvas({
  layer, detectors, routes, panels, sirens, motionSensors, keypads, controlDevices,
  detectorModels, motionSensorModels, zones, mode,
  selectedDetectorModelId,
  selectedPlacedDetectorId, selectedPlacedMotionSensorId,
  scale, onPlaceDetector, onMoveDetector, onMovePanel, onMoveSiren, onMoveMotionSensor,
  onMoveKeypad, onMoveControlDevice, onSelectPlacedDetector, onSelectPlacedMotionSensor,
  onRotateMotionSensor,
  onAddRoutePoint, onFinishRoute, onPlacePanel, onPlaceSiren,
  onPlaceMotionSensor, onPlaceKeypad, onPlaceControlDevice, onScalePoint,
  drawingRoute, scalePoints, showCoverage, showZones, scaleLocked,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const draggingRef = useRef<DragTarget | null>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [rotatingMs, setRotatingMs] = useState<string | null>(null);
  const rotatingMsRef = useRef<string | null>(null);
  const rotateCenter = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const screenToNorm = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - pan.x) / (containerSize.w * zoom),
      y: (sy - pan.y) / (containerSize.h * zoom),
    };
  }, [pan, zoom, containerSize]);

  const normToScreen = useCallback((nx: number, ny: number) => {
    return {
      x: nx * containerSize.w * zoom + pan.x,
      y: ny * containerSize.h * zoom + pan.y,
    };
  }, [pan, zoom, containerSize]);

  const rangeToPixels = useCallback((meters: number) => {
    if (!scale) return meters * 20;
    const p1s = normToScreen(scale.p1.x, scale.p1.y);
    const p2s = normToScreen(scale.p2.x, scale.p2.y);
    const calibPixels = Math.sqrt((p2s.x - p1s.x) ** 2 + (p2s.y - p1s.y) ** 2);
    if (scale.realDistanceM === 0) return meters * 20;
    return (meters / scale.realDistanceM) * calibPixels;
  }, [scale, normToScreen]);

  const HIT_RADIUS = 16;

  const hitTestElement = useCallback((sx: number, sy: number): DragTarget | null => {
    for (let i = controlDevices.length - 1; i >= 0; i--) {
      const el = controlDevices[i];
      const es = normToScreen(el.x, el.y);
      if (Math.abs(es.x - sx) < HIT_RADIUS && Math.abs(es.y - sy) < HIT_RADIUS) return { type: 'controlDevice', id: el.id };
    }
    for (let i = keypads.length - 1; i >= 0; i--) {
      const el = keypads[i];
      const es = normToScreen(el.x, el.y);
      if (Math.abs(es.x - sx) < HIT_RADIUS && Math.abs(es.y - sy) < HIT_RADIUS) return { type: 'keypad', id: el.id };
    }
    for (let i = motionSensors.length - 1; i >= 0; i--) {
      const el = motionSensors[i];
      const es = normToScreen(el.x, el.y);
      if (Math.abs(es.x - sx) < HIT_RADIUS && Math.abs(es.y - sy) < HIT_RADIUS) return { type: 'motionSensor', id: el.id };
    }
    for (let i = sirens.length - 1; i >= 0; i--) {
      const el = sirens[i];
      const es = normToScreen(el.x, el.y);
      if (Math.abs(es.x - sx) < HIT_RADIUS && Math.abs(es.y - sy) < HIT_RADIUS) return { type: 'siren', id: el.id };
    }
    for (let i = panels.length - 1; i >= 0; i--) {
      const el = panels[i];
      const es = normToScreen(el.x, el.y);
      if (Math.abs(es.x - sx) < 18 && Math.abs(es.y - sy) < 18) return { type: 'panel', id: el.id };
    }
    for (let i = detectors.length - 1; i >= 0; i--) {
      const el = detectors[i];
      const es = normToScreen(el.x, el.y);
      if (Math.abs(es.x - sx) < 14 && Math.abs(es.y - sy) < 14) return { type: 'detector', id: el.id };
    }
    return null;
  }, [detectors, panels, sirens, motionSensors, keypads, controlDevices, normToScreen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const norm = screenToNorm(sx, sy);

    if (mode === 'navigate') {
      const hit = hitTestElement(sx, sy);
      if (hit) {
        draggingRef.current = hit;
        setDragging(hit);
        if (hit.type === 'detector') {
          onSelectPlacedDetector(hit.id);
          onSelectPlacedMotionSensor(null);
        } else if (hit.type === 'motionSensor') {
          onSelectPlacedMotionSensor(hit.id);
          onSelectPlacedDetector(null);
        } else {
          onSelectPlacedDetector(null);
          onSelectPlacedMotionSensor(null);
        }
        lastMouse.current = { x: sx, y: sy };
        return;
      }
      onSelectPlacedDetector(null);
      onSelectPlacedMotionSensor(null);
      isPanning.current = true;
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    if (scaleLocked && mode !== 'set_scale') return;

    if (mode === 'place_detector' && selectedDetectorModelId) {
      onPlaceDetector(norm.x, norm.y);
      return;
    }
    if (mode === 'draw_route') {
      onAddRoutePoint(norm.x, norm.y);
      return;
    }
    if (mode === 'place_panel') {
      onPlacePanel(norm.x, norm.y);
      return;
    }
    if (mode === 'place_siren') {
      onPlaceSiren(norm.x, norm.y);
      return;
    }
    if (mode === 'place_motion_sensor') {
      onPlaceMotionSensor(norm.x, norm.y);
      return;
    }
    if (mode === 'place_keypad') {
      onPlaceKeypad(norm.x, norm.y);
      return;
    }
    if (mode === 'place_control_device') {
      onPlaceControlDevice(norm.x, norm.y);
      return;
    }
    if (mode === 'set_scale') {
      onScalePoint(norm.x, norm.y);
      return;
    }
  }, [mode, scaleLocked, selectedDetectorModelId, screenToNorm, hitTestElement, onPlaceDetector, onAddRoutePoint, onPlacePanel, onPlaceSiren, onPlaceMotionSensor, onPlaceKeypad, onPlaceControlDevice, onScalePoint, onSelectPlacedDetector, onSelectPlacedMotionSensor]);

  const moveElement = useCallback((target: DragTarget, nx: number, ny: number) => {
    switch (target.type) {
      case 'detector': onMoveDetector(target.id, nx, ny); break;
      case 'panel': onMovePanel(target.id, nx, ny); break;
      case 'siren': onMoveSiren(target.id, nx, ny); break;
      case 'motionSensor': onMoveMotionSensor(target.id, nx, ny); break;
      case 'keypad': onMoveKeypad(target.id, nx, ny); break;
      case 'controlDevice': onMoveControlDevice(target.id, nx, ny); break;
    }
  }, [onMoveDetector, onMovePanel, onMoveSiren, onMoveMotionSensor, onMoveKeypad, onMoveControlDevice]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (rotatingMsRef.current && rotateCenter.current) {
      const angle = Math.atan2(sy - rotateCenter.current.y, sx - rotateCenter.current.x) * (180 / Math.PI);
      onRotateMotionSensor(rotatingMsRef.current, Math.round(angle));
      return;
    }

    if (draggingRef.current) {
      const norm = screenToNorm(sx, sy);
      moveElement(draggingRef.current, norm.x, norm.y);
      return;
    }
    if (isPanning.current) {
      setPan(prev => ({
        x: prev.x + (sx - lastMouse.current.x),
        y: prev.y + (sy - lastMouse.current.y),
      }));
      lastMouse.current = { x: sx, y: sy };
    }
  }, [screenToNorm, moveElement, onRotateMotionSensor]);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    setDragging(null);
    isPanning.current = false;
    if (rotatingMsRef.current) {
      rotatingMsRef.current = null;
      setRotatingMs(null);
      rotateCenter.current = null;
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * factor, 0.2), 10);
    setPan(prev => ({
      x: mx - (mx - prev.x) * (newZoom / zoom),
      y: my - (my - prev.y) * (newZoom / zoom),
    }));
    setZoom(newZoom);
  }, [zoom]);

  const handleDoubleClick = useCallback(() => {
    if (mode === 'draw_route') onFinishRoute();
  }, [mode, onFinishRoute]);

  const startRotateMs = useCallback((msId: string, centerScreenX: number, centerScreenY: number) => {
    rotatingMsRef.current = msId;
    setRotatingMs(msId);
    rotateCenter.current = { x: centerScreenX, y: centerScreenY };
  }, []);

  const getDetectorColor = (modelId: string) => {
    const model = detectorModels.find(m => m.id === modelId);
    return DETECTOR_TYPE_COLORS[model?.detector_type ?? 'smoke'] ?? '#3b82f6';
  };

  const getZoneColor = (detectorId: string) => {
    const zoneIdx = zones.findIndex(z => z.detectorIds.includes(detectorId));
    if (zoneIdx < 0) return null;
    return zones[zoneIdx].color || ZONE_COLORS[zoneIdx % ZONE_COLORS.length];
  };

  const vw = containerSize.w * zoom;
  const vh = containerSize.h * zoom;

  const cursorStyle = mode === 'navigate'
    ? (dragging || rotatingMs ? 'grabbing' : 'grab')
    : (scaleLocked && mode !== 'set_scale' ? 'not-allowed' : 'crosshair');

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-950 select-none"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      {scaleLocked && mode !== 'set_scale' && mode !== 'navigate' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none">
          <div className="bg-slate-900/95 border border-red-500/30 rounded-2xl px-6 py-4 text-center shadow-2xl">
            <div className="text-red-400 text-sm font-extrabold mb-1">Nastav měřítko</div>
            <div className="text-slate-400 text-xs">Před vložením prvku je nutné nakalibrovat měřítko půdorysu (M)</div>
          </div>
        </div>
      )}

      <svg
        width={containerSize.w}
        height={containerSize.h}
        className="absolute inset-0"
      >
        <defs>
          <pattern id="eps-grid" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)} width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={0.5} fill="rgba(255,255,255,0.04)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#eps-grid)" />

        <g transform={`translate(${pan.x},${pan.y})`}>
          {layer?.imageData && (
            <image href={layer.imageData} x={0} y={0} width={vw} height={vh} preserveAspectRatio="none" opacity={0.85} />
          )}

          {routes.map(route => {
            if (route.points.length < 2) return null;
            const pts = route.points.map(p => `${p.x * vw},${p.y * vh}`).join(' ');
            return (
              <g key={route.id}>
                <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
                <polyline points={pts} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />
              </g>
            );
          })}

          {drawingRoute.length > 0 && (
            <polyline
              points={drawingRoute.map(p => `${p.x * vw},${p.y * vh}`).join(' ')}
              fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 4" opacity={0.8}
            />
          )}

          {showCoverage && detectors.map(d => {
            const model = detectorModels.find(m => m.id === d.modelId);
            if (!model || model.detection_range_m <= 0) return null;
            const sx = d.x * vw;
            const sy = d.y * vh;
            const radiusPx = rangeToPixels(model.detection_range_m);
            const color = getDetectorColor(d.modelId);
            if (model.detector_type === 'linear') {
              const angle = (d.rotationDeg * Math.PI) / 180;
              const ex = sx + Math.cos(angle) * radiusPx;
              const ey = sy + Math.sin(angle) * radiusPx;
              return (
                <line key={`cov-${d.id}`} x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke={color} strokeWidth={3} opacity={0.3} strokeDasharray="8 4" />
              );
            }
            return (
              <circle key={`cov-${d.id}`} cx={sx} cy={sy} r={radiusPx}
                fill={color} fillOpacity={0.08} stroke={color} strokeWidth={1} strokeOpacity={0.25} strokeDasharray="4 4" />
            );
          })}

          {showCoverage && motionSensors.map(ms => {
            const model = motionSensorModels.find(m => m.id === ms.sensorId);
            if (!model || model.detection_range_m <= 0) return null;
            const sx = ms.x * vw;
            const sy = ms.y * vh;
            const radiusPx = rangeToPixels(model.detection_range_m);
            if (model.sensor_type === 'curtain') {
              const angle = (ms.rotationDeg * Math.PI) / 180;
              const ex = sx + Math.cos(angle) * radiusPx;
              const ey = sy + Math.sin(angle) * radiusPx;
              return (
                <line key={`cov-ms-${ms.id}`} x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke="#06b6d4" strokeWidth={3} opacity={0.3} strokeDasharray="8 4" />
              );
            }
            const angleDeg = model.detection_angle_deg;
            if (angleDeg > 0 && angleDeg < 360) {
              const startAngle = ms.rotationDeg - angleDeg / 2;
              const endAngle = ms.rotationDeg + angleDeg / 2;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const x1 = sx + Math.cos(startRad) * radiusPx;
              const y1 = sy + Math.sin(startRad) * radiusPx;
              const x2 = sx + Math.cos(endRad) * radiusPx;
              const y2 = sy + Math.sin(endRad) * radiusPx;
              const largeArc = angleDeg > 180 ? 1 : 0;
              const pathD = `M ${sx} ${sy} L ${x1} ${y1} A ${radiusPx} ${radiusPx} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              return (
                <path key={`cov-ms-${ms.id}`} d={pathD}
                  fill="#06b6d4" fillOpacity={0.08} stroke="#06b6d4" strokeWidth={1} strokeOpacity={0.25} strokeDasharray="4 4" />
              );
            }
            return (
              <circle key={`cov-ms-${ms.id}`} cx={sx} cy={sy} r={radiusPx}
                fill="#06b6d4" fillOpacity={0.08} stroke="#06b6d4" strokeWidth={1} strokeOpacity={0.25} strokeDasharray="4 4" />
            );
          })}

          {showZones && detectors.map(d => {
            const zc = getZoneColor(d.id);
            if (!zc) return null;
            const sx = d.x * vw;
            const sy = d.y * vh;
            return <circle key={`zone-${d.id}`} cx={sx} cy={sy} r={22} fill={zc} fillOpacity={0.15} stroke={zc} strokeWidth={2} strokeOpacity={0.4} />;
          })}

          {showZones && motionSensors.map(ms => {
            const zc = getZoneColor(ms.id);
            if (!zc) return null;
            const sx = ms.x * vw;
            const sy = ms.y * vh;
            return <circle key={`zone-ms-${ms.id}`} cx={sx} cy={sy} r={22} fill={zc} fillOpacity={0.15} stroke={zc} strokeWidth={2} strokeOpacity={0.4} />;
          })}

          {panels.map(p => {
            const sx = p.x * vw;
            const sy = p.y * vh;
            return (
              <g key={p.id}>
                <rect x={sx - 16} y={sy - 16} width={32} height={32} rx={6} fill="#1e293b" stroke="#6366f1" strokeWidth={2} />
                <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" fill="#a5b4fc" fontSize={10} fontWeight="bold">CPU</text>
              </g>
            );
          })}

          {sirens.map(s => {
            const sx = s.x * vw;
            const sy = s.y * vh;
            return (
              <g key={s.id}>
                <circle cx={sx} cy={sy} r={12} fill="#1e293b" stroke="#f97316" strokeWidth={2} />
                <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" fill="#fdba74" fontSize={8} fontWeight="bold">SIR</text>
              </g>
            );
          })}

          {motionSensors.map(ms => {
            const sx = ms.x * vw;
            const sy = ms.y * vh;
            const isSelected = selectedPlacedMotionSensorId === ms.id;
            const dirRad = (ms.rotationDeg * Math.PI) / 180;
            const dirLen = 20;
            return (
              <g key={ms.id}>
                {isSelected && <circle cx={sx} cy={sy} r={18} fill="none" stroke="#22d3ee" strokeWidth={2} strokeDasharray="3 3" />}
                <rect x={sx - 10} y={sy - 10} width={20} height={20} rx={2} fill="#1e293b" stroke="#06b6d4" strokeWidth={2} transform={`rotate(45 ${sx} ${sy})`} />
                <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" fill="#67e8f9" fontSize={7} fontWeight="bold">PIR</text>
                <line
                  x1={sx} y1={sy}
                  x2={sx + Math.cos(dirRad) * dirLen} y2={sy + Math.sin(dirRad) * dirLen}
                  stroke="#06b6d4" strokeWidth={1.5} opacity={0.6}
                  markerEnd="url(#arrow-cyan)"
                />
                {isSelected && (
                  <circle
                    cx={sx + Math.cos(dirRad) * 32}
                    cy={sy + Math.sin(dirRad) * 32}
                    r={6}
                    fill="#06b6d4"
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startRotateMs(ms.id, sx + pan.x, sy + pan.y);
                    }}
                  />
                )}
                {ms.label && (
                  <text x={sx} y={sy + 22} textAnchor="middle" fill="#e2e8f0" fontSize={9} fontWeight="bold">{ms.label}</text>
                )}
              </g>
            );
          })}

          {keypads.map(kp => {
            const sx = kp.x * vw;
            const sy = kp.y * vh;
            return (
              <g key={kp.id}>
                <rect x={sx - 14} y={sy - 10} width={28} height={20} rx={6} fill="#1e293b" stroke="#10b981" strokeWidth={2} />
                <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" fill="#6ee7b7" fontSize={8} fontWeight="bold">KLV</text>
              </g>
            );
          })}

          {controlDevices.map(cd => {
            const sx = cd.x * vw;
            const sy = cd.y * vh;
            return (
              <g key={cd.id}>
                <circle cx={sx} cy={sy} r={11} fill="#1e293b" stroke="#f59e0b" strokeWidth={2} />
                <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" fill="#fcd34d" fontSize={7} fontWeight="bold">OVL</text>
              </g>
            );
          })}

          {detectors.map(d => {
            const sx = d.x * vw;
            const sy = d.y * vh;
            const color = getDetectorColor(d.modelId);
            const isSelected = selectedPlacedDetectorId === d.id;
            const model = detectorModels.find(m => m.id === d.modelId);
            const isManualCallPoint = model?.detector_type === 'manual_call_point';
            return (
              <g key={d.id}>
                {isSelected && <circle cx={sx} cy={sy} r={16} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="3 3" />}
                {isManualCallPoint ? (
                  <rect x={sx - 9} y={sy - 9} width={18} height={18} rx={3} fill={color} stroke="#fff" strokeWidth={1.5} />
                ) : (
                  <circle cx={sx} cy={sy} r={9} fill={color} stroke="#fff" strokeWidth={1.5} />
                )}
                {d.label && (
                  <text x={sx} y={sy + 20} textAnchor="middle" fill="#e2e8f0" fontSize={9} fontWeight="bold">{d.label}</text>
                )}
              </g>
            );
          })}

          {scalePoints.map((p, i) => {
            const sx = p.x * vw;
            const sy = p.y * vh;
            return <circle key={`sp-${i}`} cx={sx} cy={sy} r={5} fill="#22d3ee" stroke="#fff" strokeWidth={1.5} />;
          })}
          {scalePoints.length === 2 && (
            <line
              x1={scalePoints[0].x * vw} y1={scalePoints[0].y * vh}
              x2={scalePoints[1].x * vw} y2={scalePoints[1].y * vh}
              stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3"
            />
          )}

          {scale && (
            <>
              <line
                x1={scale.p1.x * vw} y1={scale.p1.y * vh}
                x2={scale.p2.x * vw} y2={scale.p2.y * vh}
                stroke="#22d3ee" strokeWidth={1} strokeDasharray="4 4" opacity={0.4}
              />
              <text
                x={(scale.p1.x + scale.p2.x) / 2 * vw}
                y={(scale.p1.y + scale.p2.y) / 2 * vh - 6}
                textAnchor="middle" fill="#22d3ee" fontSize={10} fontWeight="bold" opacity={0.6}
              >
                {scale.realDistanceM}m
              </text>
            </>
          )}
        </g>

        <defs>
          <marker id="arrow-cyan" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" opacity="0.6" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
