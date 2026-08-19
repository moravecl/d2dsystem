import type { Product } from '../../../types/database';
import type { SelectionState, Placement } from '../../../hooks/useProjectState';

export interface PinData {
  productId: string;
  product: Product;
  placement: Placement;
  seq: number;
  label: string;
}

export function listAllPins(selected: SelectionState, products: Product[], floorId?: string): PinData[] {
  const pins: PinData[] = [];

  for (const pid of Object.keys(selected)) {
    const product = products.find((p) => p.id === pid);
    if (!product) continue;

    const code = product.code.toUpperCase() || product.brand.slice(0, 2).toUpperCase();
    const all = [...selected[pid].placements].sort((a, b) => a.ts - b.ts);
    const filtered = floorId ? all.filter((pl) => pl.floorId === floorId) : all;

    all.forEach((pl, idx) => {
      if (filtered.includes(pl)) {
        pins.push({
          productId: pid,
          product,
          placement: pl,
          seq: idx + 1,
          label: `${code}${idx + 1}`,
        });
      }
    });
  }

  pins.sort((a, b) => a.placement.ts - b.placement.ts);
  return pins;
}

export function listAllPinsGlobal(selected: SelectionState, products: Product[]): PinData[] {
  const pins: PinData[] = [];
  for (const pid of Object.keys(selected)) {
    const product = products.find((p) => p.id === pid);
    if (!product) continue;
    const code = product.code.toUpperCase() || product.brand.slice(0, 2).toUpperCase();
    const placements = [...selected[pid].placements].sort((a, b) => a.ts - b.ts);
    placements.forEach((pl, idx) => {
      pins.push({ productId: pid, product, placement: pl, seq: idx + 1, label: `${code}${idx + 1}` });
    });
  }
  pins.sort((a, b) => a.placement.ts - b.placement.ts);
  return pins;
}

function condenseModuleList(modules: string[]): string {
  const counts: Record<string, number> = {};
  for (const m of modules) counts[m] = (counts[m] || 0) + 1;
  return Object.entries(counts).map(([name, cnt]) => cnt > 1 ? `${cnt}x ${name}` : name).join(', ');
}

export function describeConfig(cfg?: { frameSize: number; modules: string[]; colorName?: string; colorHex?: string }): string {
  if (!cfg) return '';
  const base = cfg.modules && cfg.modules.length > 0
    ? `${cfg.frameSize}R: ${condenseModuleList(cfg.modules)}`
    : `${cfg.frameSize}R`;
  return cfg.colorName ? `${base} | ${cfg.colorName}` : base;
}
