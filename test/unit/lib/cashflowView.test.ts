import { describe, expect, it } from 'vitest';

import { cashflowBarProgress, expenseBreakdownRows } from '../../../src/lib/cashflowView';

describe('cashflowBarProgress', () => {
  it('sin datos: 0', () => expect(cashflowBarProgress({ kind: 'NONE' })).toBe(0));
  it('sin gastos con pasivo: llena', () => expect(cashflowBarProgress({ kind: 'NO_EXPENSES' })).toBe(100));
  it('42%: 42', () => expect(cashflowBarProgress({ kind: 'RATIO', ratio: 0.42 })).toBe(42));
  it('150%: limitada a 100', () => expect(cashflowBarProgress({ kind: 'RATIO', ratio: 1.5 })).toBe(100));
  it('0,996 (redondea a 100 pero no es libertad): 100', () =>
    expect(cashflowBarProgress({ kind: 'RATIO', ratio: 0.996 })).toBe(100));
  it('ratio 0: 0', () => expect(cashflowBarProgress({ kind: 'RATIO', ratio: 0 })).toBe(0));
});

describe('expenseBreakdownRows', () => {
  it('solo vida cuando no hay deuda ni metas', () => {
    expect(expenseBreakdownRows({ gastoVida: 0, gastoDeuda: 0, gastoMetas: 0 }).map((r) => r.key)).toEqual(['life']);
  });
  it('incluye deuda y metas con monto', () => {
    const rows = expenseBreakdownRows({ gastoVida: 100, gastoDeuda: 50, gastoMetas: 25 });
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['life', 100],
      ['debt', 50],
      ['goals', 25],
    ]);
  });
});
