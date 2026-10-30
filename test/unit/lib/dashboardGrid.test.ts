import { describe, expect, it } from 'vitest';

import { dashboardColumns, dashboardRows, type DashboardCell } from '../../../src/lib/dashboardGrid';

const keys = (rows: DashboardCell[][]) => rows.map((r) => r.map((c) => `${c.key}:${c.span}`));
const none = { cashflow: false, debts: false, goals: false };
const all = { cashflow: true, debts: true, goals: true };

describe('dashboardRows', () => {
  it('usa 3 columnas en wide y 2 en medium', () => {
    expect(dashboardColumns('wide')).toBe(3);
    expect(dashboardColumns('medium')).toBe(2);
  });

  it('wide con todo activo sigue el diseño 2a', () => {
    expect(keys(dashboardRows('wide', all))).toEqual([
      ['cashflow:1', 'monthFlow:1', 'accounts:1'],
      ['recent:2', 'upcoming:1'],
      ['debts:1', 'goals:1'],
    ]);
  });

  it('wide sin opcionales deja las filas fijas', () => {
    expect(keys(dashboardRows('wide', none))).toEqual([
      ['monthFlow:1', 'accounts:1'],
      ['recent:2', 'upcoming:1'],
    ]);
  });

  it('medium reparte en 2 columnas y recent ocupa la fila', () => {
    expect(keys(dashboardRows('medium', all))).toEqual([
      ['cashflow:1', 'monthFlow:1'],
      ['accounts:1'],
      ['recent:2'],
      ['upcoming:1', 'debts:1'],
      ['goals:1'],
    ]);
  });

  it('nunca excede las columnas de la cuadrícula', () => {
    for (const size of ['medium', 'wide'] as const) {
      for (const row of dashboardRows(size, all)) {
        expect(row.reduce((s, c) => s + c.span, 0)).toBeLessThanOrEqual(dashboardColumns(size));
      }
    }
  });
});
