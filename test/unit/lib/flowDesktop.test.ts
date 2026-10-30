import { describe, expect, it } from 'vitest';

import {
  CASHFLOW_SCALE_MARKS,
  axisTicks,
  barHeightPercent,
  isFutureBucket,
  lastMonths,
  tooltipSide,
  trendHeights,
} from '../../../src/lib/flowDesktop';

describe('flowDesktop', () => {
  it('barHeightPercent escala contra el tope y acota', () => {
    expect(barHeightPercent(50, 200)).toBe(25);
    expect(barHeightPercent(300, 200)).toBe(100);
    expect(barHeightPercent(0, 200)).toBe(0);
    expect(barHeightPercent(-5, 200)).toBe(0);
    expect(barHeightPercent(10, 0)).toBe(0);
  });

  it('axisTicks va de arriba hacia abajo', () => {
    expect(axisTicks(100, 2)).toEqual([100, 50, 0]);
    expect(axisTicks(0, 2)).toEqual([0, 0, 0]);
  });

  it('isFutureBucket solo marca tramos que empiezan después de hoy', () => {
    expect(isFutureBucket('2026-11-01', '2026-10-30')).toBe(true);
    expect(isFutureBucket('2026-10-30', '2026-10-30')).toBe(false);
    expect(isFutureBucket('2026-10-01', '2026-10-30')).toBe(false);
  });

  it('tooltipSide abre hacia adentro en los bordes', () => {
    expect(tooltipSide(0, 12)).toBe('left');
    expect(tooltipSide(1, 12)).toBe('left');
    expect(tooltipSide(6, 12)).toBe('center');
    expect(tooltipSide(11, 12)).toBe('right');
    expect(tooltipSide(0, 4)).toBe('center');
  });

  it('lastMonths cruza el cambio de año', () => {
    expect(lastMonths(2026, 2, 6)).toEqual([
      { year: 2025, month: 9 },
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
    expect(lastMonths(2026, 10, 1)).toEqual([{ year: 2026, month: 10 }]);
  });

  it('trendHeights usa el mayor como 100 y tolera todo en cero', () => {
    expect(trendHeights([10, 20, 5])).toEqual([50, 100, 25]);
    expect(trendHeights([0, 0])).toEqual([0, 0]);
    expect(trendHeights([])).toEqual([]);
  });

  it('las marcas del Índice son 0/25/50/75/100', () => {
    expect(CASHFLOW_SCALE_MARKS).toEqual([0, 25, 50, 75, 100]);
  });
});
