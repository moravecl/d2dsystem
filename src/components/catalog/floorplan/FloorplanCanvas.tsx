import type { Room, FloorScale, Circuit, Cable, Dimension, FloorDistributor } from '../../../hooks/useProjectState';
import { sanitizeSvg } from '../../../lib/sanitize';
import type { CircuitType } from '../../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../../hooks/useHeatingSystems';
import { polygonCentroid, polygonAreaM2, getDoorWallPoints, distanceBetween } from './geometry';
import { generateHeatingPipes, pipeSpacingToNorm } from './heatingPipeGenerator';
import type { PipePattern } from './heatingPipeGenerator';
import type { Product, FloorplanSymbol } from '../../../types/database';
import { getRotatedSvgContent, mmToNormalized } from './floorplanObjects';
import type { FloorplanObjectData } from './floorplanObjects';
import type { BathroomSymbol } from './BathroomDesigner';
import type { SnapGuide } from './snapEngine';

interface Props {
  rooms: Room[];
  cables: Cable[];
  circuits: Circuit[];
  dimensions: Dimension[];
  distributors: FloorDistributor[];
  scale?: FloorScale;
  roomLighting?: Record<string, { required: number; current: number; deficit: number }>;
  heatingSystems: HeatingSystemFull[];
  showHeatingPipes: boolean;
  showGrid: boolean;
  visibleLayers: Record<CircuitType, boolean>;
  hiddenCircuitIds?: Set<string>;
  isDrawingRoom: boolean;
  roomDrawingPoints: { x: number; y: number }[];
  isDrawingCable: boolean;
  cableDrawingPoints: { x: number; y: number }[];
  activeCircuitId: string | null;
  scaleTempPoints: { x: number; y: number }[];
  dimTempPoints: { x: number; y: number }[];
  floorplanObjects?: FloorplanObjectData[];
  products?: Product[];
  activeObjectId?: string | null;
  draggingObject?: { objectId: string; x: number; y: number } | null;
  canvasAspectRatio?: number;
  bathroomSymbols?: BathroomSymbol[];
  snappedMousePos?: { x: number; y: number } | null;
  snapGuides?: SnapGuide[];
}

export default function FloorplanCanvas({
  rooms,
  cables,
  circuits,
  dimensions,
  distributors,
  scale,
  heatingSystems,
  showHeatingPipes,
  showGrid,
  visibleLayers,
  hiddenCircuitIds,
  isDrawingRoom,
  roomDrawingPoints,
  isDrawingCable,
  cableDrawingPoints,
  activeCircuitId,
  scaleTempPoints,
  dimTempPoints,
  floorplanObjects = [],
  products: allProducts = [],
  activeObjectId,
  draggingObject,
  canvasAspectRatio = 1,
  bathroomSymbols = [],
  snappedMousePos,
  snapGuides = [],
}: Props) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
      {rooms.map((room) => {
        const c = polygonCentroid(room.points);
        const doors = room.doors ?? [];
        const doorsByWall = new Map<number, typeof doors>();
        for (const d of doors) {
          const list = doorsByWall.get(d.wallIndex) ?? [];
          list.push(d);
          doorsByWall.set(d.wallIndex, list);
        }

        const wallSegments: React.ReactNode[] = [];
        const doorArcs: React.ReactNode[] = [];
        const pts = room.points;

        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const wallDoors = doorsByWall.get(i);

          if (!wallDoors || wallDoors.length === 0 || !scale) {
            wallSegments.push(
              <line key={`w-${room.id}-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#14b8a6" strokeWidth="0.003" />
            );
          } else {
            const calibDist = distanceBetween(scale.p1, scale.p2);
            const wallLen = distanceBetween(a, b);
            if (calibDist === 0 || wallLen === 0) {
              wallSegments.push(
                <line key={`w-${room.id}-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="#14b8a6" strokeWidth="0.003" />
              );
            } else {
              const meterInNorm = calibDist / scale.realDistanceM;
              const ux = (b.x - a.x) / wallLen;
              const uy = (b.y - a.y) / wallLen;
              const nx = -uy;
              const ny = ux;

              const gaps = wallDoors
                .map((d) => {
                  const halfW = (d.widthM / 2) * meterInNorm;
                  const center = d.position;
                  const centerNorm = center * wallLen;
                  return { t1: Math.max(0, (centerNorm - halfW) / wallLen), t2: Math.min(1, (centerNorm + halfW) / wallLen), door: d, halfW };
                })
                .sort((x, y) => x.t1 - y.t1);

              let cursor = 0;
              for (const gap of gaps) {
                if (gap.t1 > cursor) {
                  const sx = a.x + ux * wallLen * cursor;
                  const sy = a.y + uy * wallLen * cursor;
                  const ex = a.x + ux * wallLen * gap.t1;
                  const ey = a.y + uy * wallLen * gap.t1;
                  wallSegments.push(
                    <line key={`w-${room.id}-${i}-${cursor}`}
                      x1={sx} y1={sy} x2={ex} y2={ey}
                      stroke="#14b8a6" strokeWidth="0.003" />
                  );
                }

                const dp1x = a.x + ux * wallLen * gap.t1;
                const dp1y = a.y + uy * wallLen * gap.t1;
                const dp2x = a.x + ux * wallLen * gap.t2;
                const dp2y = a.y + uy * wallLen * gap.t2;
                const r = gap.halfW * 2;
                const arcEnd1x = dp1x + nx * r;
                const arcEnd1y = dp1y + ny * r;

                doorArcs.push(
                  <g key={`door-${gap.door.id}`}>
                    <line x1={dp1x} y1={dp1y} x2={dp2x} y2={dp2y}
                      stroke="#d97706" strokeWidth="0.002" strokeDasharray="0.004,0.003" />
                    <line x1={dp1x} y1={dp1y} x2={arcEnd1x} y2={arcEnd1y}
                      stroke="#d97706" strokeWidth="0.0015" />
                    <path
                      d={`M ${arcEnd1x} ${arcEnd1y} A ${r} ${r} 0 0 1 ${dp2x} ${dp2y}`}
                      fill="none" stroke="#d97706" strokeWidth="0.0015" strokeDasharray="0.005,0.003"
                    />
                  </g>
                );

                cursor = gap.t2;
              }

              if (cursor < 1) {
                const sx = a.x + ux * wallLen * cursor;
                const sy = a.y + uy * wallLen * cursor;
                wallSegments.push(
                  <line key={`w-${room.id}-${i}-end`}
                    x1={sx} y1={sy} x2={b.x} y2={b.y}
                    stroke="#14b8a6" strokeWidth="0.003" />
                );
              }
            }
          }
        }

        const bathroomItems = (room.bathroomLayout ?? []).flatMap((pl) => {
          if (!scale) return [];
          const sym = bathroomSymbols.find((s) => s.id === pl.symbolId);
          if (!sym) return [];
          const w = mmToNormalized(sym.width_mm, scale);
          const h = mmToNormalized(sym.height_mm, scale);
          const rot = ((pl.rotation % 360) + 360) % 360;
          const ox = pl.x - w / 2;
          const oy = pl.y - h / 2;

          const transforms: string[] = [];
          if (rot !== 0) transforms.push(`rotate(${rot},${pl.x},${pl.y})`);
          if (pl.flipX) transforms.push(`translate(${pl.x * 2},0) scale(-1,1)`);
          const combined = transforms.join(' ');

          return [(
            <g key={`bath-${pl.id}`} opacity="0.55" style={{ pointerEvents: 'none' }}>
              <g transform={combined || undefined}>
                <svg
                  x={ox}
                  y={oy}
                  width={w}
                  height={h}
                  viewBox={`0 0 ${sym.width_mm} ${sym.height_mm}`}
                  preserveAspectRatio="none"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(sym.svg_content) }}
                />
              </g>
            </g>
          )];
        });

        return (
          <g key={room.id}>
            <polygon
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(20,184,166,0.12)"
              stroke="none"
            />
            {bathroomItems}
            {wallSegments}
            {doorArcs}
            {!room.labelHidden && (
              <text
                x={c.x + (room.labelOffsetX ?? 0)} y={c.y + (room.labelOffsetY ?? 0)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0f766e"
                fontSize={room.labelSize ?? 0.018}
                fontWeight="800"
                style={{ pointerEvents: 'none' }}
              >
                {room.name}
              </text>
            )}
          </g>
        );
      })}

      {showHeatingPipes && scale && rooms.map((room) => {
        if (!room.heatingSystemId) return null;
        const sys = heatingSystems.find((s) => s.system.id === room.heatingSystemId);
        if (!sys) return null;
        const hasPipes = sys.options.some((o) => o.slug === 'pipe_spacing');
        if (!hasPipes) return null;
        const cfg = room.heatingConfig ?? {};
        const spacingMm = parseInt(cfg['pipe_spacing'] || '150', 10);
        const spacingNorm = pipeSpacingToNorm(spacingMm, scale);
        if (spacingNorm <= 0) return null;
        const pattern = (cfg['pipe_pattern'] || 'meandr') as PipePattern;
        const pipePath = generateHeatingPipes(room.points, spacingNorm, pattern);
        if (pipePath.length < 2) return null;
        return (
          <g key={`heat-${room.id}`}>
            <polyline
              points={pipePath.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#ef4444"
              strokeWidth="0.0018"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
          </g>
        );
      })}

      {isDrawingRoom && roomDrawingPoints.length > 0 && (
        <g>
          {roomDrawingPoints.length >= 3 && (
            <polygon
              points={roomDrawingPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(20,184,166,0.08)"
              stroke="none"
            />
          )}
          {roomDrawingPoints.length > 1 && (
            <polyline
              points={roomDrawingPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="#14b8a6" strokeWidth="0.003" strokeLinecap="round" strokeLinejoin="round"
            />
          )}
          {snappedMousePos && (() => {
            const last = roomDrawingPoints[roomDrawingPoints.length - 1];
            return (
              <line x1={last.x} y1={last.y} x2={snappedMousePos.x} y2={snappedMousePos.y}
                stroke="#14b8a6" strokeWidth="0.003" strokeDasharray="0.008,0.005" strokeLinecap="round" opacity="0.45" />
            );
          })()}
          {roomDrawingPoints.length >= 3 && (
            <line
              x1={roomDrawingPoints[roomDrawingPoints.length - 1].x}
              y1={roomDrawingPoints[roomDrawingPoints.length - 1].y}
              x2={roomDrawingPoints[0].x}
              y2={roomDrawingPoints[0].y}
              stroke="#14b8a6" strokeWidth="0.002" strokeDasharray="0.006,0.006" opacity="0.4"
            />
          )}
          {roomDrawingPoints.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="0.008" fill="white" stroke="#14b8a6" strokeWidth="0.002" />
              <circle cx={p.x} cy={p.y} r="0.005" fill="#14b8a6" />
              <text x={p.x + 0.012} y={p.y} textAnchor="start" dominantBaseline="central" fill="#0f766e" fontSize="0.01" fontWeight="700">
                {i + 1}
              </text>
            </g>
          ))}
          {snappedMousePos && (
            <circle cx={snappedMousePos.x} cy={snappedMousePos.y} r="0.005"
              fill="#14b8a6" stroke="white" strokeWidth="0.002" opacity="0.5" />
          )}
          {roomDrawingPoints.length >= 2 && (() => {
            const area = polygonAreaM2(roomDrawingPoints, scale ?? { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, realDistanceM: 10 });
            if (!scale || area === 0) return null;
            const c = polygonCentroid(roomDrawingPoints);
            return (
              <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fill="#0f766e" fontSize="0.014" fontWeight="800" opacity="0.7">
                {area.toFixed(1)} m2
              </text>
            );
          })()}
        </g>
      )}

      {cables.filter((cable) => {
        const circuit = circuits.find((c) => c.id === cable.circuitId);
        const tradeType = (circuit?.type ?? 'electric') as CircuitType;
        if (!visibleLayers[tradeType]) return false;
        if (hiddenCircuitIds?.has(cable.circuitId)) return false;
        return true;
      }).map((cable) => {
        const circuit = circuits.find((c) => c.id === cable.circuitId);
        return (
          <g key={cable.id}>
            <polyline
              points={cable.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={circuit?.color ?? '#888'} strokeWidth="0.004" strokeLinecap="round" strokeLinejoin="round"
            />
            {cable.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="0.004" fill={circuit?.color ?? '#888'} stroke="white" strokeWidth="0.001" />
            ))}
          </g>
        );
      })}

      {isDrawingCable && cableDrawingPoints.length > 0 && (() => {
        const color = circuits.find((c) => c.id === activeCircuitId)?.color ?? '#3b82f6';
        const last = cableDrawingPoints[cableDrawingPoints.length - 1];
        return (
          <g>
            {cableDrawingPoints.length > 1 && (
              <polyline
                points={cableDrawingPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="0.004" strokeLinecap="round" strokeLinejoin="round"
              />
            )}
            {cableDrawingPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="0.005"
                fill={color} stroke="white" strokeWidth="0.002" />
            ))}
            {snappedMousePos && (
              <g>
                <line x1={last.x} y1={last.y} x2={snappedMousePos.x} y2={snappedMousePos.y}
                  stroke={color} strokeWidth="0.003" strokeDasharray="0.008,0.005" strokeLinecap="round" opacity="0.45" />
                <circle cx={snappedMousePos.x} cy={snappedMousePos.y} r="0.005"
                  fill={color} stroke="white" strokeWidth="0.002" opacity="0.5" />
              </g>
            )}
          </g>
        );
      })()}


      {scale && (
        <g>
          <line
            x1={scale.p1.x} y1={scale.p1.y}
            x2={scale.p2.x} y2={scale.p2.y}
            stroke="#ef4444" strokeWidth="0.003" strokeDasharray="0.008,0.006"
          />
          <circle cx={scale.p1.x} cy={scale.p1.y} r="0.006" fill="#ef4444" stroke="white" strokeWidth="0.002" />
          <circle cx={scale.p2.x} cy={scale.p2.y} r="0.006" fill="#ef4444" stroke="white" strokeWidth="0.002" />
          <text
            x={(scale.p1.x + scale.p2.x) / 2}
            y={(scale.p1.y + scale.p2.y) / 2 - 0.015}
            textAnchor="middle" fill="#ef4444" fontSize="0.016" fontWeight="800"
          >
            {scale.realDistanceM} m
          </text>
        </g>
      )}

      {scaleTempPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="0.007" fill="#ef4444" stroke="white" strokeWidth="0.002" />
      ))}
      {scaleTempPoints.length === 2 && (
        <line x1={scaleTempPoints[0].x} y1={scaleTempPoints[0].y}
          x2={scaleTempPoints[1].x} y2={scaleTempPoints[1].y}
          stroke="#ef4444" strokeWidth="0.003" strokeDasharray="0.008,0.006" />
      )}

      {showGrid && scale && (() => {
        const calibDist = Math.sqrt((scale.p2.x - scale.p1.x) ** 2 + (scale.p2.y - scale.p1.y) ** 2);
        if (calibDist === 0) return null;
        const meterInNorm = calibDist / scale.realDistanceM;
        const gridStep = meterInNorm * 0.5;
        const lines: React.ReactNode[] = [];
        for (let x = 0; x <= 1; x += gridStep) {
          lines.push(<line key={`gv${x}`} x1={x} y1={0} x2={x} y2={1} stroke="#94a3b8" strokeWidth="0.001" opacity="0.3" />);
        }
        for (let y = 0; y <= 1; y += gridStep) {
          lines.push(<line key={`gh${y}`} x1={0} y1={y} x2={1} y2={y} stroke="#94a3b8" strokeWidth="0.001" opacity="0.3" />);
        }
        return <g>{lines}</g>;
      })()}

      {dimensions.map((dim) => {
        const dx = dim.p2.x - dim.p1.x;
        const dy = dim.p2.y - dim.p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let labelCm = '';
        if (scale) {
          const calibDist = Math.sqrt((scale.p2.x - scale.p1.x) ** 2 + (scale.p2.y - scale.p1.y) ** 2);
          if (calibDist > 0) {
            const meters = (dist / calibDist) * scale.realDistanceM;
            labelCm = `${Math.round(meters * 100)}`;
          }
        }
        const mx = (dim.p1.x + dim.p2.x) / 2;
        const my = (dim.p1.y + dim.p2.y) / 2;
        const angle = Math.atan2(dy, dx);
        const perpX = -Math.sin(angle) * 0.005;
        const perpY = Math.cos(angle) * 0.005;
        return (
          <g key={dim.id}>
            <line x1={dim.p1.x} y1={dim.p1.y} x2={dim.p2.x} y2={dim.p2.y} stroke="#1e293b" strokeWidth="0.0008" />
            <line x1={dim.p1.x + perpX} y1={dim.p1.y + perpY} x2={dim.p1.x - perpX} y2={dim.p1.y - perpY} stroke="#1e293b" strokeWidth="0.0008" />
            <line x1={dim.p2.x + perpX} y1={dim.p2.y + perpY} x2={dim.p2.x - perpX} y2={dim.p2.y - perpY} stroke="#1e293b" strokeWidth="0.0008" />
            {labelCm && (
              <>
                <rect x={mx - 0.014} y={my - 0.006} width="0.028" height="0.01" fill="white" fillOpacity="0.85" />
                <text x={mx} y={my + 0.0005} textAnchor="middle" dominantBaseline="central" fill="#1e293b" fontSize="0.008" fontWeight="600">
                  {labelCm}
                </text>
              </>
            )}
          </g>
        );
      })}

      {dimTempPoints.length === 1 && (
        <circle cx={dimTempPoints[0].x} cy={dimTempPoints[0].y} r="0.006" fill="#2563eb" stroke="white" strokeWidth="0.002" />
      )}

      {snapGuides.map((g, i) => {
        const dx = g.to.x - g.from.x;
        const dy = g.to.y - g.from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) return null;
        const angle = Math.atan2(dy, dx);
        const perpX = -Math.sin(angle) * 0.005;
        const perpY = Math.cos(angle) * 0.005;
        const mx = (g.from.x + g.to.x) / 2;
        const my = (g.from.y + g.to.y) / 2;
        const labelText = g.distCm !== null ? `${g.distCm}` : '';

        if (g.type === 'wall-distance') {
          return (
            <g key={`sg-${i}`}>
              <line x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} stroke="#1e293b" strokeWidth="0.001" strokeDasharray="0.003,0.002" />
            </g>
          );
        }

        if (g.type === 'align-x' || g.type === 'align-y') {
          return (
            <g key={`sg-${i}`}>
              <line x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} stroke="#3b82f6" strokeWidth="0.001" strokeDasharray="0.004,0.003" opacity="0.6" />
            </g>
          );
        }

        if (g.type === 'spacing') {
          return (
            <g key={`sg-${i}`}>
              <line x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} stroke="#10b981" strokeWidth="0.001" strokeDasharray="0.004,0.003" opacity="0.6" />
              {labelText && (
                <>
                  <rect x={mx - 0.018} y={my - 0.007} width="0.036" height="0.011" rx="0.002" fill="#10b981" fillOpacity="0.85" />
                  <text x={mx} y={my + 0.0005} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="0.008" fontWeight="700">{labelText}</text>
                </>
              )}
            </g>
          );
        }

        return (
          <g key={`sg-${i}`}>
            <line x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} stroke="#1e293b" strokeWidth="0.0008" />
            <line x1={g.from.x + perpX} y1={g.from.y + perpY} x2={g.from.x - perpX} y2={g.from.y - perpY} stroke="#1e293b" strokeWidth="0.0008" />
            <line x1={g.to.x + perpX} y1={g.to.y + perpY} x2={g.to.x - perpX} y2={g.to.y - perpY} stroke="#1e293b" strokeWidth="0.0008" />
            {labelText && (
              <>
                <rect x={mx - 0.014} y={my - 0.006} width="0.028" height="0.01" fill="white" fillOpacity="0.85" />
                <text x={mx} y={my + 0.0005} textAnchor="middle" dominantBaseline="central" fill="#1e293b" fontSize="0.008" fontWeight="600">{labelText}</text>
              </>
            )}
          </g>
        );
      })}

      {scale && floorplanObjects.map((obj) => {
        const product = allProducts.find((p) => p.id === obj.productId);
        if (!product || !product.floorplan_symbol) return null;
        const symbol = product.floorplan_symbol as FloorplanSymbol;
        if (symbol.type === 'pin') return null;

        const baseW = mmToNormalized(symbol.width_mm ?? 0, scale);
        const baseH = mmToNormalized(symbol.height_mm ?? 0, scale);
        const rot = ((obj.rotation % 360) + 360) % 360;
        const svgW = (rot === 90 || rot === 270) ? baseH : baseW;
        const svgH = (rot === 90 || rot === 270) ? baseW : baseH;
        const isDragObj = draggingObject?.objectId === obj.id;
        const cx = isDragObj ? draggingObject.x : obj.x;
        const cy = isDragObj ? draggingObject.y : obj.y;
        const ox = cx - svgW / 2;
        const oy = cy - svgH / 2;

        let flipStr = '';
        if (obj.flipX || obj.flipY) {
          flipStr = `translate(${cx},${cy})`;
          if (obj.flipX) flipStr += ' scale(-1,1)';
          if (obj.flipY) flipStr += ' scale(1,-1)';
          flipStr += ` translate(${-cx},${-cy})`;
        }

        const isActive = obj.id === activeObjectId;

        return (
          <g key={obj.id}>
            {symbol.type === 'rect' && (
              <rect
                x={ox}
                y={oy}
                width={svgW}
                height={svgH}
                fill={isActive ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)'}
                stroke={isActive ? '#2563eb' : '#3b82f6'}
                strokeWidth="0.002"
                transform={flipStr || undefined}
              />
            )}
            {symbol.type === 'svg' && symbol.svg_content && (() => {
              const rotated = getRotatedSvgContent(symbol, obj.rotation);
              return (
                <g transform={flipStr || undefined}>
                  <svg
                    x={ox}
                    y={oy}
                    width={svgW}
                    height={svgH}
                    viewBox={rotated.viewBox}
                    preserveAspectRatio="none"
                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(rotated.content) }}
                  />
                  {isActive && (
                    <rect
                      x={ox}
                      y={oy}
                      width={svgW}
                      height={svgH}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="0.002"
                      strokeDasharray="0.006,0.004"
                    />
                  )}
                </g>
              );
            })()}
            <rect
              x={cx - 0.03}
              y={oy - 0.015}
              width="0.06"
              height="0.013"
              rx="0.002"
              fill="white"
              fillOpacity="0.92"
              stroke="#3b82f6"
              strokeWidth="0.001"
            />
            <text
              x={cx}
              y={oy - 0.0085}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1e40af"
              fontSize="0.008"
              fontWeight="800"
            >
              {product.code}
            </text>
          </g>
        );
      })}

      {distributors.map((dist) => {
        const heatedRooms = rooms.filter((r) => r.heatingSystemId);
        return (
          <g key={dist.id}>
            {heatedRooms.map((room) => {
              const c = polygonCentroid(room.points);
              return (
                <line
                  key={room.id}
                  x1={dist.x} y1={dist.y}
                  x2={c.x} y2={c.y}
                  stroke="#ef4444"
                  strokeWidth="0.003"
                  strokeDasharray="0.008,0.005"
                  opacity="0.6"
                />
              );
            })}
            <circle cx={dist.x} cy={dist.y} r="0.012" fill="#ef4444" stroke="white" strokeWidth="0.003" />
            <text x={dist.x} y={dist.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="0.009" fontWeight="800">R</text>
            <text x={dist.x} y={dist.y - 0.018} textAnchor="middle" fill="#ef4444" fontSize="0.012" fontWeight="800">{dist.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
