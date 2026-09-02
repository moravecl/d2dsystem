import type { SectionKey } from '../selectionPdfExport';

export type PriceLevel = 'none' | 'totals' | 'full';

export interface PdfExportOptions {
  sections: Record<SectionKey, boolean>;
  /** Ktera podlazi vykreslit v pudorysech (plne i remeslne) - klic floor.id. */
  floorIds: Record<string, boolean>;
  /** Ktera remesla vykreslit v sekci Remesla - klic z ALL_TRADES. */
  trades: Record<string, boolean>;
  priceLevel: PriceLevel;
  /** Nazev souboru bez pripony; prazdny = vychozi podle projektu. */
  fileName: string;
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  products: 'Produkty podle kategorií',
  rooms: 'Rozložení podle místností',
  cables: 'Trasy a kabely',
  materials: 'Materiál',
  fittings: 'Tvarovky',
  breakers: 'Jištění',
  ventilation: 'Rekuperace',
  lighting: 'Osvětlení',
  fv_system: 'Fotovoltaický systém',
  camera_system: 'Kamerový systém',
  schematic: 'Schematický návrh',
  floorplans: 'Půdorysy s piny',
  trades: 'Řemesla (trasy po podlažích)',
  heating: 'Vytápění – kalkulace materiálu',
};

export const SECTION_ORDER: SectionKey[] = [
  'products', 'rooms', 'cables', 'materials', 'fittings', 'breakers',
  'ventilation', 'lighting', 'fv_system', 'camera_system', 'schematic',
  'floorplans', 'trades', 'heating',
];

export function defaultOptions(floorIds: string[], trades: string[]): PdfExportOptions {
  const sections = Object.fromEntries(SECTION_ORDER.map(k => [k, true])) as Record<SectionKey, boolean>;
  return {
    sections,
    floorIds: Object.fromEntries(floorIds.map(id => [id, true])),
    trades: Object.fromEntries(trades.map(t => [t, true])),
    priceLevel: 'full',
    fileName: '',
  };
}

const STORAGE_PREFIX = 'selectionPdfOptions:v1:';

export function loadStoredOptions(storageKey: string, floorIds: string[], trades: string[]): PdfExportOptions {
  const base = defaultOptions(floorIds, trades);
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return base;
    const stored = JSON.parse(raw) as Partial<PdfExportOptions>;
    return {
      sections: { ...base.sections, ...(stored.sections ?? {}) },
      // nova podlazi/remesla, ktera v ulozenych volbach nejsou, zustavaji zapnuta
      floorIds: { ...base.floorIds, ...(stored.floorIds ?? {}) },
      trades: { ...base.trades, ...(stored.trades ?? {}) },
      priceLevel: stored.priceLevel === 'none' || stored.priceLevel === 'totals' ? stored.priceLevel : 'full',
      fileName: typeof stored.fileName === 'string' ? stored.fileName : '',
    };
  } catch {
    return base;
  }
}

export function saveStoredOptions(storageKey: string, options: PdfExportOptions) {
  try {
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(options));
  } catch {
    // plne uloziste nesmi export zastavit
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
}
