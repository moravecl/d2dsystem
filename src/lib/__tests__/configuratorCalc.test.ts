import { describe, it, expect } from 'vitest';
import { calculateQuoteTotals } from '../configurator/calc';
import { DEFAULT_CONFIGURATOR_CONFIG, createDefaultQuoteState } from '../configurator/defaults';

const config = DEFAULT_CONFIGURATOR_CONFIG;

describe('konfigurátor — výpočet nabídky', () => {
  it('topení: základ odpovídá ručnímu součtu položek', () => {
    const s = createDefaultQuoteState(config);
    const t = calculateQuoteTotals(s, config);
    // hp_aku 320000 + 1.NP 75*1450 + 2.NP 75*2100 + radiátory 2*8000 + krb 18000
    expect(t.resHeating.base).toBe(320000 + 75 * 1450 + 75 * 2100 + 2 * 8000 + 18000);
  });

  it('vypnutí sekce sníží součet přesně o její cenu', () => {
    const s = createDefaultQuoteState(config);
    const before = calculateQuoteTotals(s, config);
    s.fve.active = false;
    const after = calculateQuoteTotals(s, config);
    // globální sleva % je 0, takže rozdíl je přesně finalní cena sekce
    expect(before.totalFinal - after.totalFinal).toBeCloseTo(before.resFve.final, 5);
  });

  it('ruční cena sekce přebije výpočet', () => {
    const s = createDefaultQuoteState(config);
    s.electro.manualPrice = 100000;
    const t = calculateQuoteTotals(s, config);
    expect(t.resElectro.final).toBe(100000);
  });

  it('přirážka se aplikuje před slevou', () => {
    const s = createDefaultQuoteState(config);
    s.water.surcharge = 10;
    s.water.discountPercent = 50;
    const t = calculateQuoteTotals(s, config);
    expect(t.resWater.final).toBeCloseTo(t.resWater.base * 1.1 * 0.5, 5);
  });

  it('DPH a dotace: totalWithVat = final * (1 + sazba), dotace se odečítá po DPH', () => {
    const s = createDefaultQuoteState(config);
    const t = calculateQuoteTotals(s, config);
    expect(t.totalWithVat).toBeCloseTo(t.totalFinal * 1.12, 5);
    // výchozí stav: dotace jen FVE (160000)
    expect(t.totalSubsidy).toBe(160000);
    expect(t.finalPriceAfterSubsidy).toBeCloseTo(t.totalWithVat - 160000, 5);
  });

  it('kWp a kapacita baterie z katalogu', () => {
    const s = createDefaultQuoteState(config);
    const t = calculateQuoteTotals(s, config);
    expect(t.kwp).toBeCloseTo((24 * 450) / 1000, 5);
    expect(t.batteryCapacity).toBeCloseTo(2 * 5.8, 5);
  });

  it('globální sleva % se počítá po bonusu za komplet a obchodní slevě', () => {
    const s = createDefaultQuoteState(config);
    s.fees.manualDiscount = 10000;
    s.fees.globalDiscountPercent = 10;
    const t = calculateQuoteTotals(s, config);
    const base = calculateQuoteTotals({ ...s, fees: { ...s.fees, globalDiscountPercent: 0 } }, config);
    expect(t.totalFinal).toBeCloseTo(base.totalFinal * 0.9, 5);
  });

  it('zisk sekce = finální cena minus odhad nákladů z marže', () => {
    const s = createDefaultQuoteState(config);
    const t = calculateQuoteTotals(s, config);
    const expectedCost = t.resHeating.base * (1 - s.heating.margin / 100);
    expect(t.resHeating.profit).toBeCloseTo(t.resHeating.final - expectedCost, 5);
  });
});
