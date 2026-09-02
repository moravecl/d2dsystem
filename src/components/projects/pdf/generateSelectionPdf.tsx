/**
 * Nativni export souhrnu do PDF: slozi bitmapy pudorysu, lazy-nacte
 * @react-pdf/renderer (velky chunk mimo hlavni bundle), zaregistruje fonty
 * s ceskou diakritikou a stahne hotovy soubor.
 */
import robotoRegular from '../../../assets/fonts/Roboto-Regular.ttf';
import robotoMedium from '../../../assets/fonts/Roboto-Medium.ttf';
import robotoBold from '../../../assets/fonts/Roboto-Bold.ttf';
import type { ExportData } from '../selectionPdfExport';
import { buildFullFloorplanOverlaySvg, buildTradeFloorplanOverlaySvg } from '../selectionPdfExport';
import { ALL_TRADES } from '../../catalog/floorplan/materialLibrary';
import { listAllPins } from '../../catalog/floorplan/pinUtils';
import type { PdfExportOptions } from './exportOptions';
import { sanitizeFileName } from './exportOptions';
import { composeFloorplan, type ComposedPlan } from './composeFloorplans';

let fontsRegistered = false;

function registerFonts(Font: typeof import('@react-pdf/renderer').Font) {
  if (fontsRegistered) return;
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: robotoRegular, fontWeight: 400 },
      { src: robotoMedium, fontWeight: 500 },
      { src: robotoBold, fontWeight: 700 },
    ],
  });
  // cestina se nema delit na slabiky podle anglickych pravidel
  Font.registerHyphenationCallback(word => [word]);
  fontsRegistered = true;
}

export async function generateSelectionPdf(data: ExportData, options: PdfExportOptions): Promise<void> {
  const planImages: Record<string, ComposedPlan> = {};
  const tradePlanImages: Record<string, ComposedPlan> = {};

  if (options.sections.floorplans !== false) {
    for (const floor of data.floors) {
      if (!floor.floorplanImg || options.floorIds[floor.id] === false) continue;
      const overlay = buildFullFloorplanOverlaySvg(
        floor, data.selected, data.products, data.categories, data.heatingSystems,
        data.designElements ?? [], data.elementTypes ?? [], data.mountingGroups ?? [],
        data.floors, data.schematicSymbolScale ?? 24, data.categoryColorMap ?? {},
      );
      planImages[floor.id] = await composeFloorplan(floor.floorplanImg, overlay);
    }
  }

  if (options.sections.trades !== false) {
    for (const trade of ALL_TRADES) {
      if (options.trades[trade] === false) continue;
      for (const floor of data.floors) {
        if (!floor.floorplanImg || options.floorIds[floor.id] === false) continue;
        const fAllCircuits = floor.circuits ?? [];
        const hasCircuits = fAllCircuits.some(c => (c.type ?? 'electric') === trade);
        const hasPins = listAllPins(data.selected, data.products, floor.id).some(pin => (pin.product.trade || 'electric') === trade);
        if (!hasCircuits && !hasPins) continue;
        const overlay = buildTradeFloorplanOverlaySvg(trade, floor, data.selected, data.products, data.categories, data.heatingSystems);
        tradePlanImages[`${trade}:${floor.id}`] = await composeFloorplan(floor.floorplanImg, overlay);
      }
    }
  }

  const [renderer, docModule] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./SelectionPdfDocument'),
  ]);
  registerFonts(renderer.Font);
  const SelectionPdfDocument = docModule.default;

  const blob = await renderer.pdf(
    <SelectionPdfDocument data={data} options={options} planImages={planImages} tradePlanImages={tradePlanImages} />
  ).toBlob();

  const base = sanitizeFileName(options.fileName) || `Souhrn projektu - ${sanitizeFileName(data.projectName || 'Projekt') || 'Projekt'}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
