import { describe, expect, it } from 'vitest';

import { goalsCountLabel, incomeSharePercent, transactionLabel } from '../../../src/lib/dashboardFormat';

describe('incomeSharePercent', () => {
  it('reparte la barra segun ingresos y gastos', () => {
    expect(incomeSharePercent(98_000_000, 61_000_000)).toBe(62);
    expect(incomeSharePercent(100, 100)).toBe(50);
    expect(incomeSharePercent(0, 500)).toBe(0);
    expect(incomeSharePercent(500, 0)).toBe(100);
  });
  it('mes sin movimiento: 50/50 como el diseno', () => {
    expect(incomeSharePercent(0, 0)).toBe(50);
  });
});

describe('transactionLabel', () => {
  const base = { description: '', categoryName: null, debtName: null, type: 'EXPENSE' as const };
  it('prefiere la descripcion y luego categoria, deuda o tipo', () => {
    expect(transactionLabel({ ...base, description: '  Supermercado ', categoryName: 'Comida' })).toBe('Supermercado');
    expect(transactionLabel({ ...base, categoryName: 'Comida' })).toBe('Comida');
    expect(transactionLabel({ ...base, debtName: 'Visa' })).toBe('Visa');
    expect(transactionLabel(base)).toBe('Gasto');
    expect(transactionLabel({ ...base, type: 'INCOME' })).toBe('Ingreso');
  });
});

describe('goalsCountLabel', () => {
  it('singular y plural', () => {
    expect(goalsCountLabel(1)).toBe('1 meta activa');
    expect(goalsCountLabel(2)).toBe('2 metas activas');
  });
});
