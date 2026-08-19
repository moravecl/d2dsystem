import { useState } from 'react';
import type { Category, Product, FloorplanSymbol } from '../../../types/database';
import type { Floor } from '../../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../../hooks/useHeatingSystems';
import type { BathroomSymbol } from '../floorplan/BathroomDesigner';
import type { PinData } from '../floorplan/pinUtils';
import { describeConfig } from '../floorplan/pinUtils';
import { polygonCentroid, distanceBetween } from '../floorplan/geometry';
import { generateHeatingPipes, pipeSpacingToNorm } from '../floorplan/heatingPipeGenerator';
import type { PipePattern } from '../floorplan/heatingPipeGenerator';
import { renderPinIcon, renderPinIconSvgPath, getCustomIconLetter } from '../floorplan/iconLibrary';
import { mmToNormalized, getRotatedSvgContent } from '../floorplan/floorplanObjects';
import { getPrintColor } from './summaryUtils';
import type { ProjectDesignElement, DesignElementType } from '../../../types/designElements';
import type { MountingGroupWithSlots } from '../../../hooks/useMountingGroups';
import { getFloorDesignElements, getFloorMountingGroups } from './summaryUtils';
import { useCategoryColors } from '../../../hooks/useCategoryColors';

interface Props {
  floor: Floor;
  floors: Floor[];
  floorPins: PinData[];
  products: Product[];
  categories: Category[];
  heatingSystems: HeatingSystemFull[];
  roomIdToName: (id: string) => string;
  pinSize?: number;
  schematicSymbolScale?: number;
  bathroomSymbols?: BathroomSymbol[];
  designElements?: ProjectDesignElement[];
  elementTypes?: DesignElementType[];
  mountingGroups?: MountingGroupWithSlots[];
}

export default function SummaryFloorplanView({ floor, floors, floorPins, products, categories, heatingSystems, roomIdToName, pinSize = 28, schematicSymbolScale = 24, bathroomSymbols = [], designElements = [], elementTypes = [], mountingGroups = [] }: Props) {
  const [canvasAR, setCanvasAR] = useState(1);
  const { colorMap: categoryColorMap } = useCategoryColors();
  const rooms = floor.rooms ?? [];
  const cables = floor.cables ?? [];
  const circuits = floor.circuits ?? [];
  const floorObjects = floor.objects ?? [];
  const floorDesignElements = getFloorDesignElements(floor, floors, designElements);
  const floorMountingGroups = getFloorMountingGroups(floor, floors, mountingGroups);
  const getTypeById = (id: string) => elementTypes.find(t => t.id === id);

  return (
    <div className="mt-6 print:mt-8 print:break-before-page">
      <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-2 print:text-sm print:text-white print:mb-4">
        {`${floor.name} \u2013 Půdorys s piny`}
      </div>
      <div className="border border-white/10 rounded-2xl overflow-hidden inline-block bg-white/[0.06] print:rounded-none print:border print:w-full print:block print:overflow-visible">
        <div className="relative inline-block print:block print:w-full">
          <img
            src={floor.floorplanImg!}
            alt={floor.name}
            className="max-w-full h-auto block print:w-full"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setCanvasAR(img.naturalWidth / img.naturalHeight);
              }
            }}
          />

          {(rooms.length > 0 || cables.length > 0) && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
              {rooms.map((room) => {
                const c = polygonCentroid(room.points);
                return (
                  <g key={room.id}>
                    <polygon
                      points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(20,184,166,0.10)"
                      stroke="#14b8a6"
                      strokeWidth="0.002"
                    />
                    <text
                      x={c.x} y={c.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#0f766e"
                      fontSize="0.016"
                      fontWeight="800"
                    >
                      {room.name}
                    </text>
                  </g>
                );
              })}
              {floor.scale && rooms.filter((r) => r.heatingSystemId).map((room) => {
                const sys = heatingSystems.find((s) => s.system.id === room.heatingSystemId);
                if (!sys) return null;
                const hasPipes = sys.options.some((o) => o.slug === 'pipe_spacing');
                if (hasPipes) {
                  const cfg = room.heatingConfig ?? {};
                  const spacingMm = parseInt(cfg['pipe_spacing'] || '150', 10);
                  const spacingNorm = pipeSpacingToNorm(spacingMm, floor.scale!);
                  if (spacingNorm <= 0) return null;
                  const pattern = (cfg['pipe_pattern'] || 'meandr') as PipePattern;
                  const pipePath = generateHeatingPipes(room.points, spacingNorm, pattern);
                  if (pipePath.length < 2) return null;
                  return (
                    <polyline
                      key={`heat-${room.id}`}
                      points={pipePath.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none" stroke="#ef4444" strokeWidth="0.0018" strokeLinecap="round" strokeLinejoin="round" opacity="0.55"
                    />
                  );
                }
                const cfg = room.heatingConfig ?? {};
                const radCount = parseInt(cfg['calc_radiator_count'] || '', 10) || 1;
                const pts = room.points;
                if (pts.length < 3) return null;
                const walls = pts.map((p, i) => ({
                  idx: i, a: p, b: pts[(i + 1) % pts.length],
                  len: distanceBetween(p, pts[(i + 1) % pts.length]),
                }));
                walls.sort((a, b) => b.len - a.len);
                const rects: React.ReactNode[] = [];
                for (let r = 0; r < radCount; r++) {
                  const wall = walls[r % walls.length];
                  const t = radCount <= walls.length ? 0.5 : (r < walls.length ? 0.35 : 0.65);
                  const cx = wall.a.x + (wall.b.x - wall.a.x) * t;
                  const cy = wall.a.y + (wall.b.y - wall.a.y) * t;
                  const dx = wall.b.x - wall.a.x;
                  const dy = wall.b.y - wall.a.y;
                  const wlen = wall.len || 1;
                  const nx = -dy / wlen;
                  const ny = dx / wlen;
                  const radW = Math.min(wall.len * 0.3, 0.06);
                  const radH = 0.008;
                  const ox = cx + nx * 0.005;
                  const oy = cy + ny * 0.005;
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  rects.push(
                    <g key={`rad-${room.id}-${r}`} transform={`rotate(${angle},${ox},${oy})`}>
                      <rect x={ox - radW / 2} y={oy - radH / 2} width={radW} height={radH} fill="#ef4444" opacity="0.6" rx="0.001" />
                      <line x1={ox - radW / 2 + 0.003} y1={oy - radH / 2} x2={ox - radW / 2 + 0.003} y2={oy + radH / 2} stroke="#fff" strokeWidth="0.001" opacity="0.4" />
                      <line x1={ox + radW / 2 - 0.003} y1={oy - radH / 2} x2={ox + radW / 2 - 0.003} y2={oy + radH / 2} stroke="#fff" strokeWidth="0.001" opacity="0.4" />
                      <line x1={ox} y1={oy - radH / 2} x2={ox} y2={oy + radH / 2} stroke="#fff" strokeWidth="0.001" opacity="0.4" />
                    </g>
                  );
                }
                return <g key={`rads-${room.id}`}>{rects}</g>;
              })}
              {floor.scale && rooms.flatMap((room) =>
                (room.bathroomLayout ?? []).map((pl) => {
                  const sym = bathroomSymbols.find((s) => s.id === pl.symbolId);
                  if (!sym) return null;
                  const w = mmToNormalized(sym.width_mm, floor.scale!);
                  const h = mmToNormalized(sym.height_mm, floor.scale!);
                  const rot = ((pl.rotation % 360) + 360) % 360;
                  const ox = pl.x - w / 2;
                  const oy = pl.y - h / 2;
                  const transforms: string[] = [];
                  if (rot !== 0) transforms.push(`rotate(${rot},${pl.x},${pl.y})`);
                  if (pl.flipX) transforms.push(`translate(${pl.x * 2},0) scale(-1,1)`);
                  const combined = transforms.join(' ');
                  return (
                    <g key={`bath-${pl.id}`} opacity="0.55" style={{ pointerEvents: 'none' }}>
                      <g transform={combined || undefined}>
                        <svg
                          x={ox} y={oy}
                          width={w} height={h}
                          viewBox={`0 0 ${sym.width_mm} ${sym.height_mm}`}
                          preserveAspectRatio="none"
                          dangerouslySetInnerHTML={{ __html: sym.svg_content }}
                        />
                      </g>
                    </g>
                  );
                })
              )}
              {cables.map((cable) => {
                const circuit = circuits.find((ci) => ci.id === cable.circuitId);
                return (
                  <polyline
                    key={cable.id}
                    points={cable.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={circuit?.color ?? '#888'}
                    strokeWidth="0.003"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
              {floor.scale && floorObjects.map((obj) => {
                const product = products.find((p) => p.id === obj.productId);
                if (!product || !product.floorplan_symbol) return null;
                const symbol = product.floorplan_symbol as FloorplanSymbol;
                if (symbol.type === 'pin') return null;
                const baseW = mmToNormalized(symbol.width_mm ?? 0, floor.scale!);
                const baseH = mmToNormalized(symbol.height_mm ?? 0, floor.scale!);
                const rot = ((obj.rotation % 360) + 360) % 360;
                const svgW = (rot === 90 || rot === 270) ? baseH : baseW;
                const svgH = (rot === 90 || rot === 270) ? baseW : baseH;
                const cx = obj.x;
                const cy = obj.y;
                const ox = cx - svgW / 2;
                const oy = cy - svgH / 2;
                let flipStr = '';
                if (obj.flipX || obj.flipY) {
                  flipStr = `translate(${cx},${cy})`;
                  if (obj.flipX) flipStr += ' scale(-1,1)';
                  if (obj.flipY) flipStr += ' scale(1,-1)';
                  flipStr += ` translate(${-cx},${-cy})`;
                }
                return (
                  <g key={obj.id}>
                    {symbol.type === 'rect' && (
                      <rect
                        x={ox} y={oy}
                        width={svgW} height={svgH}
                        fill="rgba(59,130,246,0.15)"
                        stroke="#3b82f6"
                        strokeWidth="0.002"
                        transform={flipStr || undefined}
                      />
                    )}
                    {symbol.type === 'svg' && symbol.svg_content && (() => {
                      const rotated = getRotatedSvgContent(symbol, obj.rotation);
                      return (
                        <g transform={flipStr || undefined}>
                          <svg
                            x={ox} y={oy}
                            width={svgW} height={svgH}
                            viewBox={rotated.viewBox}
                            preserveAspectRatio="none"
                            dangerouslySetInnerHTML={{ __html: rotated.content }}
                          />
                        </g>
                      );
                    })()}
                    <text
                      x={cx} y={oy - 0.006}
                      textAnchor="middle"
                      dominantBaseline="auto"
                      fill="#3b82f6"
                      fontSize="0.012"
                      fontWeight="800"
                    >
                      {product.code}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {floorPins.length > 0 && (
            <>
              <div className="absolute inset-0 print:hidden">
                {floorPins.map((pin) => {
                  const pcat = categories.find((c) => c.id === pin.product.category_id);
                  const pc = getPrintColor(pcat?.pill_color ?? '');
                  const pinCircuit = pin.placement.circuitId
                    ? circuits.find((c) => c.id === pin.placement.circuitId)
                    : null;
                  const hasIcon = !!pin.placement.icon;
                  return (
                    <div
                      key={pin.placement.id}
                      className="absolute flex flex-col items-center"
                      style={{
                        left: `${pin.placement.x * 100}%`,
                        top: `${pin.placement.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div
                        className="rounded-full shadow ring-2 ring-white"
                        style={{ backgroundColor: pinCircuit?.color ?? pc.dot, width: pinSize, height: pinSize, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'circle(50%)' }}
                      >
                        {hasIcon ? renderPinIcon(pin.placement.icon, Math.round(pinSize * 0.6)) : (
                          <span className="font-extrabold text-white leading-none" style={{ fontSize: Math.max(6, Math.round(pinSize * 0.28)) }}>{pin.label}</span>
                        )}
                      </div>
                      <div className="mt-px bg-white/[0.06] px-0.5 py-px rounded font-extrabold text-slate-300  whitespace-nowrap leading-tight" style={{ fontSize: Math.max(5, Math.round(pinSize * 0.24)) }}>
                        {pin.label}
                      </div>
                    </div>
                  );
                })}
              </div>
              <svg className="absolute inset-0 w-full h-full pointer-events-none hidden print:block" viewBox="0 0 1 1" preserveAspectRatio="none">
                {floorPins.map((pin) => {
                  const pcat = categories.find((c) => c.id === pin.product.category_id);
                  const pc = getPrintColor(pcat?.pill_color ?? '');
                  const pinCircuit = pin.placement.circuitId
                    ? circuits.find((c) => c.id === pin.placement.circuitId)
                    : null;
                  const bgColor = pinCircuit?.color ?? pc.dot;
                  const svgPath = renderPinIconSvgPath(pin.placement.icon);
                  const customLetter = getCustomIconLetter(pin.placement.icon);
                  const r = 0.012;
                  return (
                    <g key={`print-${pin.placement.id}`}>
                      <circle cx={pin.placement.x} cy={pin.placement.y} r={r} fill={bgColor} stroke="#fff" strokeWidth="0.002" />
                      {svgPath ? (
                        <svg
                          x={pin.placement.x - r * 0.6}
                          y={pin.placement.y - r * 0.6}
                          width={r * 1.2}
                          height={r * 1.2}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d={svgPath} />
                        </svg>
                      ) : customLetter ? (
                        <text
                          x={pin.placement.x}
                          y={pin.placement.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#fff"
                          fontSize={r * 1.2}
                          fontWeight="800"
                        >
                          {customLetter}
                        </text>
                      ) : (
                        <text
                          x={pin.placement.x}
                          y={pin.placement.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#fff"
                          fontSize={r * 0.9}
                          fontWeight="800"
                        >
                          {pin.label}
                        </text>
                      )}
                      <text
                        x={pin.placement.x}
                        y={pin.placement.y + r + 0.008}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        fill="#334155"
                        fontSize="0.008"
                        fontWeight="800"
                      >
                        {pin.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </>
          )}

          {floorDesignElements.length > 0 && (
            <>
              <div className="absolute inset-0 print:hidden">
                {floorDesignElements.map((el) => {
                  const elType = getTypeById(el.element_type_id);
                  if (!elType) return null;
                  const rotation = el.rotation || 0;
                  const symSize = schematicSymbolScale;
                  return (
                    <div
                      key={el.id}
                      className="absolute flex flex-col items-center"
                      style={{
                        left: `${el.x * 100}%`,
                        top: `${el.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: symSize,
                          height: symSize,
                          transform: `rotate(${rotation}deg)`,
                          color: categoryColorMap[elType.category] ?? '#6b7280',
                        }}
                      >
                        {renderPinIcon(elType.icon || 'dot', Math.round(symSize * 0.9), 'currentColor', categoryColorMap[elType.category] ?? '#6b7280')}
                      </div>
                      {el.quantity > 1 && (
                        <div
                          className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-blue-600 text-white font-extrabold shadow-sm"
                          style={{ width: 14, height: 14, fontSize: 9 }}
                        >
                          {el.quantity}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <svg className="absolute inset-0 w-full h-full pointer-events-none hidden print:block" viewBox="0 0 1 1" preserveAspectRatio="none">
                {floorDesignElements.map((el) => {
                  const elType = getTypeById(el.element_type_id);
                  if (!elType) return null;
                  const svgPath = renderPinIconSvgPath(elType.icon || 'dot');
                  const baseR = 0.012;
                  const scaleFactor = schematicSymbolScale / 24;
                  const r = baseR * scaleFactor;
                  const catColor = categoryColorMap[elType.category] ?? '#6b7280';
                  return (
                    <g key={`print-sch-${el.id}`}>
                      {svgPath ? (
                        <svg
                          x={el.x - r}
                          y={el.y - r}
                          width={r * 2}
                          height={r * 2}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={catColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: 'center' }}
                        >
                          <path d={svgPath} />
                        </svg>
                      ) : (
                        <text
                          x={el.x}
                          y={el.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={catColor}
                          fontSize={r * 1.2}
                          fontWeight="800"
                        >
                          {elType.name.charAt(0)}
                        </text>
                      )}
                      {el.quantity > 1 && (
                        <text
                          x={el.x + r + 0.004}
                          y={el.y - r + 0.004}
                          textAnchor="start"
                          dominantBaseline="auto"
                          fill="#2563eb"
                          fontSize="0.008"
                          fontWeight="800"
                        >
                          x{el.quantity}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </>
          )}

          {floorMountingGroups.length > 0 && (
            <div className="absolute inset-0 print:hidden pointer-events-none">
              {floorMountingGroups.map((group) => {
                const groupElements = floorDesignElements.filter(el =>
                  group.slots.some(slot => slot.element_id === el.id)
                );
                if (groupElements.length === 0) return null;
                const minX = Math.min(...groupElements.map(el => el.x));
                const maxX = Math.max(...groupElements.map(el => el.x));
                const minY = Math.min(...groupElements.map(el => el.y));
                const maxY = Math.max(...groupElements.map(el => el.y));
                const padding = 0.015;
                return (
                  <div
                    key={`mg-${group.id}`}
                    className="absolute rounded-lg border-2 border-teal-500 bg-teal-500/10"
                    style={{
                      left: `${(minX - padding) * 100}%`,
                      top: `${(minY - padding) * 100}%`,
                      width: `${(maxX - minX + padding * 2) * 100}%`,
                      height: `${(maxY - minY + padding * 2) * 100}%`,
                    }}
                  >
                    {group.label && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap">
                        {group.label}
                      </div>
                    )}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white/90 text-slate-700 text-[8px] font-bold px-1 py-0.5 rounded whitespace-nowrap">
                      {group.frame_size}x {group.orientation === 'horizontal' ? 'H' : 'V'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(floorPins.length > 0 || floorObjects.length > 0) && (
        <div className="mt-4 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.06] print:rounded-none print:mt-6">
          <table className="w-full text-sm print:text-xs">
            <thead className="bg-white/[0.04]">
              <tr>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">Pin</th>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">{`Kód`}</th>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">{`Položka`}</th>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">{`Místnost`}</th>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">Okruh</th>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">Výška</th>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">Konfigurace</th>
                <th className="text-left p-3 print:p-2 font-extrabold border-b border-white/10">{`Poznámka`}</th>
              </tr>
            </thead>
            <tbody>
              {floorPins.map((pin) => {
                const pcat = categories.find((c) => c.id === pin.product.category_id);
                const pc = getPrintColor(pcat?.pill_color ?? '');
                const pinCircuit = pin.placement.circuitId
                  ? circuits.find((ci) => ci.id === pin.placement.circuitId)
                  : null;
                return (
                  <tr key={pin.placement.id} className="border-t border-white/10">
                    <td className="p-3 print:p-2 font-extrabold">
                      <span className="flex items-center gap-1.5">
                        {pin.placement.icon ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 print:w-4 print:h-4"
                            style={{ backgroundColor: pinCircuit?.color ?? pc.dot }}
                          >
                            {renderPinIcon(pin.placement.icon, 11)}
                          </span>
                        ) : (
                          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pc.dot }} />
                        )}
                        {pin.label}
                      </span>
                    </td>
                    <td className="p-3 print:p-2 text-slate-400">{pin.product.code}</td>
                    <td className="p-3 print:p-2">{pin.product.name}</td>
                    <td className="p-3 print:p-2 font-extrabold text-teal-700">{pin.placement.room ? roomIdToName(pin.placement.room) : '—'}</td>
                    <td className="p-3 print:p-2">
                      {pinCircuit ? (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pinCircuit.color }} />
                          <span className="font-extrabold text-slate-300">{pinCircuit.name}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 print:p-2 font-semibold text-slate-400">{pin.placement.mountingHeight || '—'}</td>
                    <td className="p-3 print:p-2 text-slate-400">
                      {pin.placement.config ? (
                        <span className="flex items-center gap-1.5">
                          {pin.placement.config.colorHex && (
                            <span className="w-3 h-3 rounded-full border border-slate-300 shrink-0 inline-block" style={{ backgroundColor: pin.placement.config.colorHex }} />
                          )}
                          {describeConfig(pin.placement.config)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 print:p-2">{pin.placement.note || '—'}</td>
                  </tr>
                );
              })}
              {floorObjects.map((obj) => {
                const product = products.find((p) => p.id === obj.productId);
                if (!product) return null;
                return (
                  <tr key={obj.id} className="border-t border-white/10 bg-blue-500/10">
                    <td className="p-3 print:p-2 font-extrabold">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded bg-blue-500 shrink-0" />
                        {product.code}
                      </span>
                    </td>
                    <td className="p-3 print:p-2 text-slate-400">{product.code}</td>
                    <td className="p-3 print:p-2">{product.name}</td>
                    <td className="p-3 print:p-2 font-extrabold text-teal-700">{obj.roomId ? roomIdToName(obj.roomId) : '—'}</td>
                    <td className="p-3 print:p-2">—</td>
                    <td className="p-3 print:p-2">—</td>
                    <td className="p-3 print:p-2 text-slate-400">—</td>
                    <td className="p-3 print:p-2">{obj.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
