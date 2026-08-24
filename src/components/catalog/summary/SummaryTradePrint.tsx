import type { Product, Category } from '../../../types/database';
import { sanitizeSvg } from '../../../lib/sanitize';
import type { SelectionState, Floor } from '../../../hooks/useProjectState';
import type { HeatingSystemFull } from '../../../hooks/useHeatingSystems';
import type { BathroomSymbol } from '../floorplan/BathroomDesigner';
import type { PinData } from '../floorplan/pinUtils';
import { listAllPins } from '../floorplan/pinUtils';
import { polylineLength, normalizedToMeters, polygonCentroid, distanceBetween } from '../floorplan/geometry';
import { generateHeatingPipes, pipeSpacingToNorm } from '../floorplan/heatingPipeGenerator';
import type { PipePattern } from '../floorplan/heatingPipeGenerator';
import { renderPinIcon } from '../floorplan/iconLibrary';
import { mmToNormalized } from '../floorplan/floorplanObjects';
import { CIRCUIT_TYPE_LABELS, ALL_TRADES } from '../floorplan/materialLibrary';
import { getPrintColor, getCableLengthStr } from './summaryUtils';

interface Props {
  floors: Floor[];
  products: Product[];
  categories: Category[];
  selected: SelectionState;
  heatingSystems: HeatingSystemFull[];
  roomIdToName: (id: string) => string;
  getWastePercent: (name: string) => number;
  getMaterialPrice: (name: string) => number;
  alwaysVisible?: boolean;
  showPrices?: boolean;
  bathroomSymbols?: BathroomSymbol[];
}

export default function SummaryTradePrint({
  floors,
  products,
  categories,
  selected,
  heatingSystems,
  roomIdToName,
  getWastePercent,
  getMaterialPrice,
  alwaysVisible,
  showPrices = true,
  bathroomSymbols = [],
}: Props) {
  const anyFloorWithScale = floors.find((f) => f.scale);

  return (
    <div className={alwaysVisible ? '' : 'hidden print:block'}>
      {ALL_TRADES.map((trade) => {
        const tradeInfo = CIRCUIT_TYPE_LABELS[trade];
        const tradeCircuits = floors.flatMap(f => (f.circuits ?? []).filter(c => (c.type ?? 'electric') === trade));
        const allPins = floors.flatMap(f => listAllPins(selected, products, f.id));
        const hasTradeProducts = allPins.some(pin => (pin.product.trade || 'electric') === trade);
        const hasHeatingRooms = trade === 'heating' && floors.some(f => (f.rooms ?? []).some(r => r.heatingSystemId));
        if (tradeCircuits.length === 0 && !hasTradeProducts && !hasHeatingRooms) return null;

        const tradeMaterialTotals: Record<string, { normalized: number; meters: number | null }> = {};
        for (const floor of floors) {
          for (const cable of floor.cables ?? []) {
            const circuit = (floor.circuits ?? []).find(c => c.id === cable.circuitId);
            if ((circuit?.type ?? 'electric') !== trade) continue;
            if (!cable.materialName) continue;
            const len = polylineLength(cable.points);
            const metersLen = floor.scale ? normalizedToMeters(len, floor.scale) : null;
            if (!tradeMaterialTotals[cable.materialName]) {
              tradeMaterialTotals[cable.materialName] = { normalized: 0, meters: null };
            }
            tradeMaterialTotals[cable.materialName].normalized += len;
            if (metersLen !== null) {
              tradeMaterialTotals[cable.materialName].meters = (tradeMaterialTotals[cable.materialName].meters ?? 0) + metersLen;
            }
          }
        }

        let tradeTotal = 0;

        return (
          <div key={trade} className="mt-8 print:break-before-page">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-slate-300">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: tradeInfo.color }} />
              <span className="text-lg font-extrabold text-white">{tradeInfo.label}</span>
            </div>

            {floors.map((floor) => {
              const fCircuits = (floor.circuits ?? []).filter(c => (c.type ?? 'electric') === trade);
              const fCables = (floor.cables ?? []).filter(cable => {
                const circuit = (floor.circuits ?? []).find(c => c.id === cable.circuitId);
                return (circuit?.type ?? 'electric') === trade;
              });
              const tradePins = listAllPins(selected, products, floor.id).filter(pin => (pin.product.trade || 'electric') === trade);
              const floorHasHeatingRooms = trade === 'heating' && (floor.rooms ?? []).some(r => r.heatingSystemId);
              if (fCircuits.length === 0 && tradePins.length === 0 && !floorHasHeatingRooms) return null;
              return (
                <div key={floor.id} className="mb-4">
                  <div className="text-xs font-extrabold text-slate-300 mb-2">{floor.name}</div>
                  {floor.floorplanImg && (
                    <div className="relative inline-block mb-3 border border-white/10 w-full">
                      <img src={floor.floorplanImg} alt={floor.name} className="w-full h-auto block" />
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
                        {(floor.rooms ?? []).map((room) => {
                          const c = polygonCentroid(room.points);
                          return (
                            <g key={room.id}>
                              <polygon
                                points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
                                fill="rgba(20,184,166,0.10)"
                                stroke="#14b8a6"
                                strokeWidth="0.002"
                              />
                              <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fill="#0f766e" fontSize="0.016" fontWeight="800">
                                {room.name}
                              </text>
                            </g>
                          );
                        })}
                        {trade === 'heating' && floor.scale && (floor.rooms ?? []).filter((r) => r.heatingSystemId).map((room) => {
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
                            idx: i,
                            a: p,
                            b: pts[(i + 1) % pts.length],
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
                            const len = wall.len || 1;
                            const nx = -dy / len;
                            const ny = dx / len;
                            const radW = Math.min(wall.len * 0.3, 0.06);
                            const radH = 0.008;
                            const ox = cx + nx * 0.005;
                            const oy = cy + ny * 0.005;
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            rects.push(
                              <g key={`rad-${room.id}-${r}`} transform={`rotate(${angle},${ox},${oy})`}>
                                <rect
                                  x={ox - radW / 2} y={oy - radH / 2}
                                  width={radW} height={radH}
                                  fill="#ef4444" opacity="0.6" rx="0.001"
                                />
                                <line x1={ox - radW / 2 + 0.003} y1={oy - radH / 2} x2={ox - radW / 2 + 0.003} y2={oy + radH / 2} stroke="#fff" strokeWidth="0.001" opacity="0.4" />
                                <line x1={ox + radW / 2 - 0.003} y1={oy - radH / 2} x2={ox + radW / 2 - 0.003} y2={oy + radH / 2} stroke="#fff" strokeWidth="0.001" opacity="0.4" />
                                <line x1={ox} y1={oy - radH / 2} x2={ox} y2={oy + radH / 2} stroke="#fff" strokeWidth="0.001" opacity="0.4" />
                              </g>
                            );
                          }
                          return <g key={`rads-${room.id}`}>{rects}</g>;
                        })}
                        {floor.scale && (floor.rooms ?? []).flatMap((room) =>
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
                                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(sym.svg_content) }}
                                  />
                                </g>
                              </g>
                            );
                          })
                        )}
                        {fCables.map((cable) => {
                          const circuit = fCircuits.find(ci => ci.id === cable.circuitId);
                          return (
                            <polyline
                              key={cable.id}
                              points={cable.points.map(p => `${p.x},${p.y}`).join(' ')}
                              fill="none" stroke={circuit?.color ?? '#888'} strokeWidth="0.004" strokeLinecap="round" strokeLinejoin="round"
                            />
                          );
                        })}
                      </svg>
                      {tradePins.length > 0 && (
                        <div className="absolute inset-0">
                          {tradePins.map((pin) => renderPinOverlay(pin, categories, fCircuits))}
                        </div>
                      )}
                    </div>
                  )}
                  {tradePins.length > 0 && (
                    <table className="w-full text-[10px] border-collapse border border-white/10 mb-3">
                      <thead>
                        <tr className="bg-white/[0.04]">
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Pin</th>
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Kód</th>
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Položka</th>
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Místnost</th>
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Okruh</th>
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Výška</th>
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Poznámka</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradePins.map((pin) => {
                          const pcat = categories.find((c) => c.id === pin.product.category_id);
                          const pc = getPrintColor(pcat?.pill_color ?? '');
                          const pinCircuit = pin.placement.circuitId ? fCircuits.find((ci) => ci.id === pin.placement.circuitId) : null;
                          return (
                            <tr key={pin.placement.id}>
                              <td className="px-2 py-1 border border-white/10 font-extrabold">
                                <span className="flex items-center gap-1">
                                  {pin.placement.icon ? (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: pinCircuit?.color ?? pc.dot }}>
                                      {renderPinIcon(pin.placement.icon, 9)}
                                    </span>
                                  ) : (
                                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pc.dot }} />
                                  )}
                                  {pin.label}
                                </span>
                              </td>
                              <td className="px-2 py-1 border border-white/10 text-slate-400">{pin.product.code}</td>
                              <td className="px-2 py-1 border border-white/10">{pin.product.name}</td>
                              <td className="px-2 py-1 border border-white/10 font-extrabold text-teal-700">{pin.placement.room ? roomIdToName(pin.placement.room) : '—'}</td>
                              <td className="px-2 py-1 border border-white/10">
                                {pinCircuit ? (
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pinCircuit.color }} />
                                    {pinCircuit.name}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-1 border border-white/10 text-slate-400">{pin.placement.mountingHeight || '—'}</td>
                              <td className="px-2 py-1 border border-white/10">{pin.placement.note || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {fCircuits.length > 0 && (
                    <table className="w-full text-[10px] border-collapse border border-white/10">
                      <thead>
                        <tr className="bg-white/[0.04]">
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Okruh</th>
                          <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Materiál</th>
                          <th className="text-right px-2 py-1 border border-white/10 font-extrabold">Délka</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fCircuits.map(circuit => {
                          const circuitCables = fCables.filter(c => c.circuitId === circuit.id);
                          return circuitCables.map((cable, idx) => (
                            <tr key={cable.id}>
                              {idx === 0 && (
                                <td className="px-2 py-1 border border-white/10 font-extrabold" rowSpan={circuitCables.length}>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: circuit.color }} />
                                    {circuit.name}
                                  </span>
                                </td>
                              )}
                              <td className="px-2 py-1 border border-white/10">{cable.materialName || '—'}</td>
                              <td className="px-2 py-1 border border-white/10 text-right font-extrabold">{getCableLengthStr(cable, floor.scale)}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}

            {Object.keys(tradeMaterialTotals).length > 0 && (
              <div className="mt-2">
                <table className="w-full text-[10px] border-collapse border border-white/10">
                  <thead>
                    <tr className="bg-white/[0.04]">
                      <th className="text-left px-2 py-1 border border-white/10 font-extrabold">Materiál</th>
                      <th className="text-right px-2 py-1 border border-white/10 font-extrabold">Délka</th>
                      {showPrices && <th className="text-right px-2 py-1 border border-white/10 font-extrabold">Kč/m</th>}
                      {showPrices && <th className="text-right px-2 py-1 border border-white/10 font-extrabold">Cena</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(tradeMaterialTotals).map(([name, data]) => {
                      const lengthM = data.meters ?? (anyFloorWithScale?.scale
                        ? normalizedToMeters(data.normalized, anyFloorWithScale.scale)
                        : null);
                      const waste = getWastePercent(name);
                      const adjustedLength = lengthM !== null ? lengthM * (1 + waste / 100) : null;
                      const pricePerM = getMaterialPrice(name);
                      const lineTotal = adjustedLength !== null && pricePerM > 0 ? adjustedLength * pricePerM : 0;
                      tradeTotal += lineTotal;
                      return (
                        <tr key={name}>
                          <td className="px-2 py-1 border border-white/10 font-extrabold">{name}</td>
                          <td className="px-2 py-1 border border-white/10 text-right font-extrabold">
                            {adjustedLength !== null ? `${adjustedLength.toFixed(1)} m` : lengthM !== null ? `${lengthM.toFixed(1)} m` : `${(data.normalized * 100).toFixed(0)} j.`}
                            {waste > 0 && <span className="text-amber-400 ml-0.5">(+{waste}%)</span>}
                          </td>
                          {showPrices && <td className="px-2 py-1 border border-white/10 text-right">{pricePerM > 0 ? `${pricePerM} Kč` : '—'}</td>}
                          {showPrices && <td className="px-2 py-1 border border-white/10 text-right font-extrabold">{lineTotal > 0 ? `${Math.round(lineTotal).toLocaleString('cs-CZ')} Kč` : '—'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  {showPrices && tradeTotal > 0 && (
                    <tfoot>
                      <tr className="bg-white/[0.04] border-t-2 border-slate-300">
                        <td colSpan={3} className="px-2 py-1 border border-white/10 font-extrabold text-right">Celkem {tradeInfo.label}</td>
                        <td className="px-2 py-1 border border-white/10 font-extrabold text-right">{Math.round(tradeTotal).toLocaleString('cs-CZ')} Kč</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderPinOverlay(pin: PinData, categories: Category[], circuits: { id: string; color: string }[]) {
  const pcat = categories.find((c) => c.id === pin.product.category_id);
  const pc = getPrintColor(pcat?.pill_color ?? '');
  const pinCircuit = pin.placement.circuitId ? circuits.find((c) => c.id === pin.placement.circuitId) : null;
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
        className="w-6 h-6 rounded-full flex items-center justify-center shadow ring-2 ring-white print:w-5 print:h-5"
        style={{ backgroundColor: pinCircuit?.color ?? pc.dot }}
      >
        {hasIcon ? renderPinIcon(pin.placement.icon, 12) : (
          <span className="text-[7px] font-extrabold text-white leading-none">{pin.label}</span>
        )}
      </div>
      <div className="mt-px bg-white/[0.06] px-0.5 py-px rounded text-[6px] font-extrabold text-slate-300  whitespace-nowrap leading-tight print:text-[5px]">
        {pin.label}
      </div>
    </div>
  );
}
