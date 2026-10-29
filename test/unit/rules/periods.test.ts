import { describe, expect, it } from 'vitest';

import {
  comparePeriods,
  monthWeeks,
  periodBuckets,
  periodMonths,
  periodOf,
  periodRange,
  shiftPeriod,
  weekOfMonth,
} from '../../../src/domain/rules/periods';

describe('semanas del mes', () => {
  it('siempre 4 semanas: 1-7, 8-14, 15-21 y 22-ultimo dia', () => {
    expect(monthWeeks(2026, 2).map((w) => [w.fromDay, w.toDay])).toEqual([[1, 7], [8, 14], [15, 21], [22, 28]]);
    expect(monthWeeks(2028, 2)[3]).toMatchObject({ fromDay: 22, toDay: 29 });
    expect(monthWeeks(2026, 4)[3]).toMatchObject({ fromDay: 22, toDay: 30 });
    expect(monthWeeks(2026, 10)[3]).toMatchObject({ fromDay: 22, toDay: 31 });
  });

  it('weekOfMonth: los dias 29-31 caen en la semana 4', () => {
    expect([1, 7, 8, 14, 15, 21, 22, 28, 29, 31].map(weekOfMonth)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4, 4]);
  });
});

describe('periodos', () => {
  it('periodOf ubica trimestre, semestre y año', () => {
    expect(periodOf('MONTH', '2026-10-28')).toEqual({ kind: 'MONTH', year: 2026, index: 10 });
    expect(periodOf('QUARTER', '2026-10-28')).toEqual({ kind: 'QUARTER', year: 2026, index: 4 });
    expect(periodOf('QUARTER', '2026-03-31').index).toBe(1);
    expect(periodOf('QUARTER', '2026-04-01').index).toBe(2);
    expect(periodOf('SEMESTER', '2026-06-30').index).toBe(1);
    expect(periodOf('SEMESTER', '2026-07-01').index).toBe(2);
    expect(periodOf('YEAR', '2026-10-28')).toEqual({ kind: 'YEAR', year: 2026, index: 1 });
  });

  it('periodMonths y periodRange', () => {
    expect(periodMonths({ kind: 'QUARTER', year: 2026, index: 4 }).map((m) => m.month)).toEqual([10, 11, 12]);
    expect(periodMonths({ kind: 'SEMESTER', year: 2026, index: 1 }).map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(periodRange({ kind: 'QUARTER', year: 2026, index: 4 })).toEqual({ from: '2026-10-01', toExclusive: '2027-01-01' });
    expect(periodRange({ kind: 'YEAR', year: 2025, index: 1 })).toEqual({ from: '2025-01-01', toExclusive: '2026-01-01' });
  });

  it('shiftPeriod cruza años', () => {
    expect(shiftPeriod({ kind: 'MONTH', year: 2026, index: 1 }, -1)).toEqual({ kind: 'MONTH', year: 2025, index: 12 });
    expect(shiftPeriod({ kind: 'QUARTER', year: 2026, index: 4 }, 1)).toEqual({ kind: 'QUARTER', year: 2027, index: 1 });
    expect(shiftPeriod({ kind: 'SEMESTER', year: 2026, index: 1 }, -1)).toEqual({ kind: 'SEMESTER', year: 2025, index: 2 });
    expect(shiftPeriod({ kind: 'YEAR', year: 2026, index: 1 }, -1)).toEqual({ kind: 'YEAR', year: 2025, index: 1 });
  });

  it('comparePeriods', () => {
    expect(comparePeriods({ kind: 'MONTH', year: 2025, index: 12 }, { kind: 'MONTH', year: 2026, index: 1 })).toBe(-1);
    expect(comparePeriods({ kind: 'MONTH', year: 2026, index: 3 }, { kind: 'MONTH', year: 2026, index: 3 })).toBe(0);
    expect(comparePeriods({ kind: 'MONTH', year: 2026, index: 4 }, { kind: 'MONTH', year: 2026, index: 3 })).toBe(1);
  });

  it('periodBuckets: 4 semanas en un mes, un tramo por mes en los demas', () => {
    expect(periodBuckets({ kind: 'MONTH', year: 2026, index: 2 })).toEqual([
      { from: '2026-02-01', toExclusive: '2026-02-08' },
      { from: '2026-02-08', toExclusive: '2026-02-15' },
      { from: '2026-02-15', toExclusive: '2026-02-22' },
      { from: '2026-02-22', toExclusive: '2026-03-01' },
    ]);
    expect(periodBuckets({ kind: 'MONTH', year: 2026, index: 12 })[3]).toEqual({ from: '2026-12-22', toExclusive: '2027-01-01' });
    expect(periodBuckets({ kind: 'QUARTER', year: 2026, index: 4 })).toEqual([
      { from: '2026-10-01', toExclusive: '2026-11-01' },
      { from: '2026-11-01', toExclusive: '2026-12-01' },
      { from: '2026-12-01', toExclusive: '2027-01-01' },
    ]);
    expect(periodBuckets({ kind: 'YEAR', year: 2026, index: 1 })).toHaveLength(12);
  });
});
