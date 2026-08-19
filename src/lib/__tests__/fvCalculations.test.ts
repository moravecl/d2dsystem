import { describe, it, expect } from 'vitest';
import { calculatePayback } from '../fvCalculations';

describe('calculatePayback', () => {
  it('vrátí návratnost v letech (nediskontovaný cumulative)', () => {
    // 300 000 investice, 60 000/rok → ~5 let (s degradací o kousek déle)
    const r = calculatePayback(300_000, 60_000, 0.5);
    expect(r.years).toBeGreaterThanOrEqual(5);
    expect(r.years).toBeLessThanOrEqual(7);
  });

  it('NPV je diskontované — menší než prostý součet přínosů', () => {
    const investment = 300_000;
    const benefit = 60_000;
    const r = calculatePayback(investment, benefit, 0, 4);
    // nediskontovaný součet za 20 let: 20*60000 - 300000 = 900 000
    const undiscounted = 20 * benefit - investment;
    expect(r.npv20).toBeLessThan(undiscounted);
    // NPV při 4 % z 60k/rok na 20 let ≈ 60000 * 13.59 - 300000 ≈ 515 400
    expect(r.npv20).toBeGreaterThan(400_000);
    expect(r.npv20).toBeLessThan(600_000);
  });

  it('vyšší diskontní sazba snižuje NPV', () => {
    const low = calculatePayback(300_000, 60_000, 0.5, 2);
    const high = calculatePayback(300_000, 60_000, 0.5, 8);
    expect(high.npv20).toBeLessThan(low.npv20);
  });

  it('nulový přínos vrací zápornou NPV a 99 let', () => {
    const r = calculatePayback(100_000, 0);
    expect(r.years).toBe(99);
    expect(r.npv20).toBe(-100_000);
  });
});
