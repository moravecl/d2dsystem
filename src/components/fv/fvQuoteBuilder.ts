import type { RoofSurface } from '../../lib/fvCalculations';
import type { QuoteItem } from '../catalog/quoteHelpers';
import type { FvHook, FvRailProfile, FvClamp, FvRoofTile } from '../../hooks/useFvCatalog';

export function buildConstructionItems(
  roofs: RoofSurface[],
  roofTiles: FvRoofTile[],
  hooks: FvHook[],
  railProfiles: FvRailProfile[],
  clamps: FvClamp[],
): QuoteItem[] {
  const items: QuoteItem[] = [];

  for (const roof of roofs) {
    if (roof.panelCount === 0 || !roof.mounting || roof.mounting.showConstruction === false) continue;
    const m = roof.mounting;

    const selTile = roofTiles.find(t => t.id === m.roofTileId);
    const selHook = hooks.find(h => h.id === m.hookId);
    const selRail = railProfiles.find(rp => rp.id === m.railProfileId);
    const selMidClamp = clamps.find(c => c.id === m.midClampId);
    const selEndClamp = clamps.find(c => c.id === m.endClampId);

    const hookSpacing = m.hookSpacingMm ?? selTile?.hook_spacing_mm ?? 350;
    const railCount = 2;
    const panelCount = roof.panelCount;
    const totalRailLengthPerRow = roof.panelWidthMm * panelCount;
    const totalRailLengthMm = totalRailLengthPerRow * railCount;
    const hooksPerRail = Math.max(2, Math.ceil(totalRailLengthPerRow / hookSpacing) + 1);
    const totalHooks = hooksPerRail * railCount;

    if (selHook && totalHooks > 0) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `Hak ${selHook.name} - ${roof.name}`,
        unit: 'ks',
        quantity: totalHooks,
        sellingPrice: selHook.price,
        costPrice: selHook.purchase_price ?? selHook.price * 0.75,
      });
    }

    if (selRail) {
      const meters = Math.round((totalRailLengthMm / 1000) * 100) / 100;
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `Profil ${selRail.name} - ${roof.name}`,
        unit: 'm',
        quantity: meters,
        sellingPrice: selRail.price_per_m,
        costPrice: selRail.purchase_price_per_m ?? selRail.price_per_m * 0.75,
      });
    }

    const midClampCount = (panelCount - 1) * railCount;
    if (selMidClamp && midClampCount > 0) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `Stredova prichytka ${selMidClamp.name} - ${roof.name}`,
        unit: 'ks',
        quantity: midClampCount,
        sellingPrice: selMidClamp.price,
        costPrice: selMidClamp.purchase_price ?? selMidClamp.price * 0.75,
      });
    }

    const endClampCount = 2 * railCount;
    if (selEndClamp && endClampCount > 0) {
      items.push({
        id: crypto.randomUUID(),
        code: '',
        name: `Krajova prichytka ${selEndClamp.name} - ${roof.name}`,
        unit: 'ks',
        quantity: endClampCount,
        sellingPrice: selEndClamp.price,
        costPrice: selEndClamp.purchase_price ?? selEndClamp.price * 0.75,
      });
    }
  }

  return items;
}

export interface ConstructionCostBreakdown {
  hooksCost: number;
  profilesCost: number;
  midClampsCost: number;
  endClampsCost: number;
  total: number;
}

export function calcConstructionCostBreakdown(
  roofs: RoofSurface[],
  roofTiles: FvRoofTile[],
  hooks: FvHook[],
  railProfiles: FvRailProfile[],
  clamps: FvClamp[],
): ConstructionCostBreakdown {
  let hooksCost = 0;
  let profilesCost = 0;
  let midClampsCost = 0;
  let endClampsCost = 0;

  for (const roof of roofs) {
    if (roof.panelCount === 0 || !roof.mounting || roof.mounting.showConstruction === false) continue;
    const m = roof.mounting;

    const selTile = roofTiles.find(t => t.id === m.roofTileId);
    const selHook = hooks.find(h => h.id === m.hookId);
    const selRail = railProfiles.find(rp => rp.id === m.railProfileId);
    const selMidClamp = clamps.find(c => c.id === m.midClampId);
    const selEndClamp = clamps.find(c => c.id === m.endClampId);

    const hookSpacing = m.hookSpacingMm ?? selTile?.hook_spacing_mm ?? 350;
    const railCount = 2;
    const panelCount = roof.panelCount;
    const totalRailLengthPerRow = roof.panelWidthMm * panelCount;
    const totalRailLengthMm = totalRailLengthPerRow * railCount;
    const hooksPerRail = Math.max(2, Math.ceil(totalRailLengthPerRow / hookSpacing) + 1);
    const totalHooks = hooksPerRail * railCount;

    if (selHook) hooksCost += totalHooks * (selHook.purchase_price ?? selHook.price * 0.75);
    if (selRail) profilesCost += (totalRailLengthMm / 1000) * (selRail.purchase_price_per_m ?? selRail.price_per_m * 0.75);
    const midCount = (panelCount - 1) * railCount;
    if (selMidClamp) midClampsCost += midCount * (selMidClamp.purchase_price ?? selMidClamp.price * 0.75);
    const endCount = 2 * railCount;
    if (selEndClamp) endClampsCost += endCount * (selEndClamp.purchase_price ?? selEndClamp.price * 0.75);
  }

  return {
    hooksCost,
    profilesCost,
    midClampsCost,
    endClampsCost,
    total: hooksCost + profilesCost + midClampsCost + endClampsCost,
  };
}

export function calcConstructionCost(
  roofs: RoofSurface[],
  roofTiles: FvRoofTile[],
  hooks: FvHook[],
  railProfiles: FvRailProfile[],
  clamps: FvClamp[],
): number {
  return calcConstructionCostBreakdown(roofs, roofTiles, hooks, railProfiles, clamps).total;
}
