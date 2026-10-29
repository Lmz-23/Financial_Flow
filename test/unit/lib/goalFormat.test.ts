import { describe, expect, it } from 'vitest';

import { goalPercent, goalProgressLabel, isGoalComplete, monthsLabel } from '../../../src/lib/goalFormat';

const base = { savedMinor: 105_000_000, targetMinor: 300_000_000 };

describe('goalPercent', () => {
  it('redondea y tolera objetivo 0', () => {
    expect(goalPercent(105_000_000, 300_000_000)).toBe(35);
    expect(goalPercent(1, 300)).toBe(0);
    expect(goalPercent(2, 3)).toBe(67);
    expect(goalPercent(10, 0)).toBe(0);
  });
});

describe('isGoalComplete', () => {
  it('cumplida con ahorro igual o mayor al objetivo', () => {
    expect(isGoalComplete({ savedMinor: 100, targetMinor: 100 })).toBe(true);
    expect(isGoalComplete({ savedMinor: 99, targetMinor: 100 })).toBe(false);
  });
});

describe('monthsLabel', () => {
  it('singular y plural', () => {
    expect(monthsLabel(1)).toBe('1 mes');
    expect(monthsLabel(9)).toBe('9 meses');
  });
});

describe('goalProgressLabel', () => {
  it('cumplida', () => {
    expect(goalProgressLabel({ savedMinor: 300, targetMinor: 300, eta: { kind: 'REACHED' } })).toBe('¡Cumplida!');
  });
  it('por ritmo: texto del diseno', () => {
    const eta = { kind: 'BY_PACE', date: '2027-07-10', monthsLeft: 9, monthlyAverageMinor: 1 } as const;
    expect(goalProgressLabel({ ...base, eta })).toBe('35% — a este ritmo, la cumples en 9 meses.');
    expect(goalProgressLabel({ ...base, eta: { ...eta, monthsLeft: 1 } })).toBe('35% — a este ritmo, la cumples en 1 mes.');
  });
  it('por fecha objetivo y vencida (inferidos)', () => {
    const eta = { kind: 'BY_TARGET_DATE', date: '2027-01-01', overdue: false, monthsLeft: 3, requiredMonthlyMinor: 65_000_000 } as const;
    expect(goalProgressLabel({ ...base, eta })).toBe('35% — para llegar a tu fecha, aparta $650.000 al mes.');
    expect(goalProgressLabel({ ...base, eta: { ...eta, overdue: true, monthsLeft: 0 } })).toBe('35% — la fecha objetivo ya pasó.');
  });
  it('sin ETA calculable (inferido)', () => {
    expect(goalProgressLabel({ ...base, eta: { kind: 'UNKNOWN' } })).toBe('35% — fecha por calcular.');
    expect(goalProgressLabel({ ...base, eta: null })).toBe('35% — fecha por calcular.');
  });
});
