import { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeSvg } from '../../../lib/sanitize';
import { X, RotateCw, Trash2, FlipHorizontal, MessageSquare, Check, Bath, Ruler } from 'lucide-react';
import type { Room, FloorScale, BathroomPlacement } from '../../../hooks/useProjectState';
import { polygonCentroid, polygonAreaM2, polygonPerimeterM, distanceBetween, normalizedToMeters } from './geometry';
import { mmToNormalized } from './floorplanObjects';
import { supabase } from '../../../lib/supabase';
import BathroomSymbolPanel from './BathroomSymbolPanel';

export interface BathroomSymbol {
  id: string;
  name: string;
  category: string;
  width_mm: number;
  height_mm: number;
  svg_content: string;
  description?: string;
}

interface Props {
  room: Room;
  scale: FloorScale;
  onSave: (layout: BathroomPlacement[]) => void;
  onClose: () => void;
}

function getBoundingBox(points: { x: number; y: number }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export default function BathroomDesigner({ room, scale, onSave, onClose }: Props) {
  const [symbols, setSymbols] = useState<BathroomSymbol[]>([]);
  const [placements, setPlacements] = useState<BathroomPlacement[]>(room.bathroomLayout ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('wc');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    supabase
      .from('bathroom_symbols')
      .select('*')
      .order('category')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setSymbols(data as BathroomSymbol[]);
      });
  }, []);

  const bbox = getBoundingBox(room.points);
  const PADDING = 0.12;
  const viewMinX = bbox.minX - bbox.w * PADDING;
  const viewMinY = bbox.minY - bbox.h * PADDING;
  const viewW = bbox.w * (1 + 2 * PADDING);
  const viewH = bbox.h * (1 + 2 * PADDING);
  const viewBox = `${viewMinX} ${viewMinY} ${viewW} ${viewH}`;

  const svgToLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    return {
      x: inv.a * clientX + inv.c * clientY + inv.e,
      y: inv.b * clientX + inv.d * clientY + inv.f,
    };
  }, []);

  const handleSymbolDrop = useCallback((sym: BathroomSymbol) => {
    const c = polygonCentroid(room.points);
    const placement: BathroomPlacement = {
      id: crypto.randomUUID(),
      symbolId: sym.id,
      x: c.x,
      y: c.y,
      rotation: 0,
      flipX: false,
      note: '',
    };
    setPlacements((p) => [...p, placement]);
    setSelectedId(placement.id);
  }, [room.points]);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const pt = svgToLocal(e.clientX, e.clientY);
    if (!pt) return;

    const hit = [...placements].reverse().find((pl) => {
      const sym = symbols.find((s) => s.id === pl.symbolId);
      if (!sym) return false;
      const w = mmToNormalized(sym.width_mm, scale);
      const h = mmToNormalized(sym.height_mm, scale);
      const hw = w / 2, hh = h / 2;
      const rot = ((pl.rotation % 360) + 360) % 360;
      const rw = (rot === 90 || rot === 270) ? hh : hw;
      const rh = (rot === 90 || rot === 270) ? hw : hh;
      return (
        pt.x >= pl.x - rw && pt.x <= pl.x + rw &&
        pt.y >= pl.y - rh && pt.y <= pl.y + rh
      );
    });

    if (hit) {
      setSelectedId(hit.id);
      setDragging({ id: hit.id, ox: pt.x - hit.x, oy: pt.y - hit.y });
      e.stopPropagation();
    } else {
      setSelectedId(null);
    }
  }, [placements, symbols, scale, svgToLocal]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const pt = svgToLocal(e.clientX, e.clientY);
    if (!pt) return;
    setPlacements((prev) =>
      prev.map((pl) =>
        pl.id === dragging.id
          ? { ...pl, x: pt.x - dragging.ox, y: pt.y - dragging.oy }
          : pl
      )
    );
  }, [dragging, svgToLocal]);

  const handleSvgMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const rotateSelected = () => {
    if (!selectedId) return;
    setPlacements((prev) =>
      prev.map((pl) => pl.id === selectedId ? { ...pl, rotation: (pl.rotation + 90) % 360 } : pl)
    );
  };

  const flipSelected = () => {
    if (!selectedId) return;
    setPlacements((prev) =>
      prev.map((pl) => pl.id === selectedId ? { ...pl, flipX: !pl.flipX } : pl)
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setPlacements((prev) => prev.filter((pl) => pl.id !== selectedId));
    setSelectedId(null);
  };

  const openNote = () => {
    if (!selectedId) return;
    const pl = placements.find((p) => p.id === selectedId);
    setNoteText(pl?.note ?? '');
    setEditingNote(selectedId);
  };

  const saveNote = () => {
    if (!editingNote) return;
    setPlacements((prev) =>
      prev.map((pl) => pl.id === editingNote ? { ...pl, note: noteText } : pl)
    );
    setEditingNote(null);
  };

  const selectedPlacement = placements.find((p) => p.id === selectedId);
  const selectedSymbol = selectedPlacement ? symbols.find((s) => s.id === selectedPlacement.symbolId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-800/60 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden" style={{ maxHeight: '95vh' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Bath className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white">Návrhář koupelny</div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{room.name}</span>
                {polygonAreaM2(room.points, scale) > 0 && (
                  <span className="flex items-center gap-1 text-cyan-700 font-extrabold bg-cyan-500/10 rounded-full px-2 py-0.5">
                    <Ruler className="w-2.5 h-2.5" />
                    {polygonAreaM2(room.points, scale).toFixed(2)} m²
                    <span className="text-slate-400 font-medium mx-0.5">·</span>
                    obvod {polygonPerimeterM(room.points, scale).toFixed(1)} m
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onSave(placements); onClose(); }}
              className="flex items-center gap-1.5 bg-cyan-600 text-white px-4 py-2 rounded-xl font-extrabold text-sm hover:bg-cyan-700 transition"
            >
              <Check className="w-4 h-4" /> Uložit
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-400 hover:bg-white/[0.06] transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <BathroomSymbolPanel
            symbols={symbols}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onPlace={handleSymbolDrop}
          />

          <div className="flex-1 flex flex-col bg-white/[0.04] overflow-hidden">
            {selectedPlacement && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border-b border-white/[0.06] shrink-0">
                <span className="text-xs font-extrabold text-slate-400 mr-2">
                  {selectedSymbol?.name ?? 'Prvek'}
                </span>
                <button onClick={rotateSelected} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-slate-300 text-xs font-extrabold hover:bg-white/[0.08] transition">
                  <RotateCw className="w-3.5 h-3.5" /> 90°
                </button>
                <button onClick={flipSelected} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-slate-300 text-xs font-extrabold hover:bg-white/[0.08] transition">
                  <FlipHorizontal className="w-3.5 h-3.5" /> Zrcadlit
                </button>
                <button onClick={openNote} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-slate-300 text-xs font-extrabold hover:bg-white/[0.08] transition">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {selectedPlacement.note ? 'Upravit pozn.' : 'Přidat pozn.'}
                </button>
                {selectedPlacement.note && (
                  <span className="text-xs text-slate-500 italic truncate max-w-xs">{selectedPlacement.note}</span>
                )}
                <button onClick={deleteSelected} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-extrabold hover:bg-red-500/20 transition">
                  <Trash2 className="w-3.5 h-3.5" /> Smazat
                </button>
              </div>
            )}

            <div className="flex-1 relative overflow-hidden p-4">
              <div className="absolute inset-4 bg-navy-800/60 rounded-2xl shadow-inner border border-white/10 overflow-hidden">
                <svg
                  ref={svgRef}
                  className="w-full h-full select-none"
                  style={{ cursor: dragging ? 'grabbing' : 'default' }}
                  viewBox={viewBox}
                  preserveAspectRatio="xMidYMid meet"
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={handleSvgMouseUp}
                >
                  <defs>
                    <pattern id="bath-grid" x={viewMinX} y={viewMinY} width="0.1" height="0.1" patternUnits="userSpaceOnUse">
                      <path d="M 0.1 0 L 0 0 0 0.1" fill="none" stroke="#e2e8f0" strokeWidth="0.001"/>
                    </pattern>
                  </defs>
                  <rect x={viewMinX} y={viewMinY} width={viewW} height={viewH} fill="url(#bath-grid)" />

                  <polygon
                    points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="rgba(6,182,212,0.06)"
                    stroke="#0891b2"
                    strokeWidth={viewW * 0.004}
                    strokeLinejoin="round"
                  />

                  {room.points.map((pt, i) => {
                    const next = room.points[(i + 1) % room.points.length];
                    const normDist = distanceBetween(pt, next);
                    const meters = normalizedToMeters(normDist, scale);
                    if (meters < 0.1) return null;
                    const mx = (pt.x + next.x) / 2;
                    const my = (pt.y + next.y) / 2;
                    const dx = next.x - pt.x;
                    const dy = next.y - pt.y;
                    const nx = -dy / normDist;
                    const ny = dx / normDist;
                    const offset = viewW * 0.025;
                    const lx = mx + nx * offset;
                    const ly = my + ny * offset;
                    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                    const textAngle = (angleDeg > 90 || angleDeg < -90) ? angleDeg + 180 : angleDeg;
                    return (
                      <g key={`wall-${i}`}>
                        <line x1={pt.x} y1={pt.y} x2={next.x} y2={next.y} stroke="#0891b2" strokeWidth={viewW * 0.001} strokeDasharray={`${viewW * 0.004},${viewW * 0.003}`} opacity="0.3" />
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#0e7490"
                          fontSize={viewH * 0.032}
                          fontWeight="700"
                          transform={`rotate(${textAngle},${lx},${ly})`}
                        >
                          {meters.toFixed(2)} m
                        </text>
                      </g>
                    );
                  })}

                  {placements.map((pl) => {
                    const sym = symbols.find((s) => s.id === pl.symbolId);
                    if (!sym) return null;

                    const w = mmToNormalized(sym.width_mm, scale);
                    const h = mmToNormalized(sym.height_mm, scale);
                    const rot = ((pl.rotation % 360) + 360) % 360;
                    const rh = (rot === 90 || rot === 270) ? w : h;
                    const ox = pl.x - w / 2;
                    const oy = pl.y - h / 2;

                    const isSelected = pl.id === selectedId;

                    const transforms: string[] = [];
                    if (rot !== 0) transforms.push(`rotate(${rot},${pl.x},${pl.y})`);
                    if (pl.flipX) transforms.push(`translate(${pl.x * 2},0) scale(-1,1)`);
                    const combined = transforms.join(' ');

                    return (
                      <g key={pl.id} style={{ cursor: dragging?.id === pl.id ? 'grabbing' : 'grab' }}>
                        <g transform={combined || undefined}>
                          <svg
                            x={ox}
                            y={oy}
                            width={w}
                            height={h}
                            viewBox={`0 0 ${sym.width_mm} ${sym.height_mm}`}
                            preserveAspectRatio="none"
                            style={{ pointerEvents: 'none' }}
                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(sym.svg_content) }}
                          />
                          <rect
                            x={ox}
                            y={oy}
                            width={w}
                            height={h}
                            fill="rgba(0,0,0,0)"
                            stroke={isSelected ? '#0891b2' : 'none'}
                            strokeWidth={viewW * 0.003}
                            strokeDasharray={`${viewW * 0.008},${viewW * 0.005}`}
                            rx={viewW * 0.003}
                          />
                        </g>
                        {pl.note && (
                          <text
                            x={pl.x}
                            y={pl.y - rh / 2 - viewH * 0.012}
                            textAnchor="middle"
                            fill="#0891b2"
                            fontSize={viewH * 0.025}
                            fontWeight="700"
                          >
                            {pl.note.length > 24 ? pl.note.slice(0, 24) + '…' : pl.note}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.06] shrink-0">
              <p className="text-[11px] text-slate-400 text-center">
                Klikni na symbol pro výběr · Táhni pro přesun · Použij panel vpravo pro přidání prvků
              </p>
            </div>
          </div>
        </div>
      </div>

      {editingNote && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-navy-800/60 rounded-2xl shadow-2xl p-6 w-80">
            <div className="text-sm font-extrabold text-white mb-3">Poznámka k prvku</div>
            <input
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') setEditingNote(null); }}
              placeholder="Např. Sprchový kout 90x90 RAL 9016..."
              className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-cyan-300 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={saveNote} className="flex-1 bg-cyan-600 text-white py-2 rounded-xl font-extrabold text-sm hover:bg-cyan-700 transition">
                Uložit
              </button>
              <button onClick={() => setEditingNote(null)} className="px-4 py-2 rounded-xl border border-white/10 text-sm font-extrabold text-slate-400 hover:bg-white/[0.04] transition">
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
