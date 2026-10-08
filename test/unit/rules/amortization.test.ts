import { describe, expect, it } from 'vitest';
import {
  estimateMonthlyRate,
  monthsWithoutRate,
  projectPayoff,
  remainingMonths,
} from '../../../src/domain/rules/amortization';

/** Valor presente de una anualidad (referencia independiente). */
const pv = (cuota: number, n: number, r: number) => (cuota * (1 - Math.pow(1 + r, -n))) / r;

describe('estimateMonthlyRate', () => {
  it('valor conocido: saldo 1.200.000, cuota 180.000, 10 meses', () => {
    const rate = estimateMonthlyRate(1_200_000, 180_000, 10);
    expect(rate).not.toBeNull();
    expect(rate as number).toBeCloseTo(0.0814417, 6);
  });

  it('la tasa devuelta reproduce el saldo (propiedad)', () => {
    const cases: [number, number, number][] = [
      [1_200_000, 180_000, 10],
      [5_000_000, 250_000, 24],
      [10_000_000, 400_000, 36],
      [100_000, 10_500, 10],
      [800_000, 800_001, 1],
    ];
    for (const [saldo, cuota, n] of cases) {
      const r = estimateMonthlyRate(saldo, cuota, n) as number;
      expect(r).toBeGreaterThan(0);
      expect(pv(cuota, n, r)).toBeCloseTo(saldo, 4);
    }
  });

  it('encuentra tasas muy altas duplicando la cota superior', () => {
    // Un solo mes: saldo 100, cuota 1000 => r = 9 (900%).
    const r = estimateMonthlyRate(100, 1000, 1) as number;
    expect(r).toBeCloseTo(9, 8);
  });

  it('encuentra tasas muy pequeñas (sin piso artificial)', () => {
    const r = estimateMonthlyRate(1_000_000, 100_001, 10) as number;
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(0.0001);
    expect(pv(100_001, 10, r)).toBeCloseTo(1_000_000, 4);
  });

  it('devuelve null si cuota * meses <= saldo', () => {
    expect(estimateMonthlyRate(1_000_000, 100_000, 10)).toBeNull();
    expect(estimateMonthlyRate(1_000_000, 90_000, 10)).toBeNull();
  });

  it.each([
    [0, 100, 10],
    [-5, 100, 10],
    [100, 0, 10],
    [100, 100, 0],
    [100, 100, -1],
    [Number.NaN, 100, 10],
    [100, Infinity, 10],
  ])('devuelve null para entradas inválidas (%d, %d, %d)', (s, c, n) => {
    expect(estimateMonthlyRate(s, c, n)).toBeNull();
  });
});

describe('projectPayoff', () => {
  it('con tasa 0 equivale a ceil(saldo/cuota)', () => {
    const p = projectPayoff(1_000, 300, 0);
    expect(p).toEqual({ status: 'PAYABLE', months: 4, totalPaid: 1_000, totalInterest: 0 });
  });

  it('reproduce los meses de la tasa estimada', () => {
    const r = estimateMonthlyRate(1_200_000, 180_000, 10) as number;
    const p = projectPayoff(1_200_000, 180_000, r);
    expect(p.status).toBe('PAYABLE');
    if (p.status === 'PAYABLE') {
      expect(p.months).toBe(10);
      // El último pago es menor o igual a la cuota; el total ronda cuota * n.
      expect(p.totalPaid).toBeLessThanOrEqual(1_800_000 + 10);
      expect(p.totalPaid).toBeGreaterThan(1_790_000);
      expect(Math.abs(p.totalInterest - (p.totalPaid - 1_200_000))).toBeLessThanOrEqual(1);
    }
  });

  it('cuota que no cubre el interés: NEVER', () => {
    expect(projectPayoff(1_000_000, 10_000, 0.02)).toEqual({ status: 'NEVER' });
    expect(projectPayoff(1_000_000, 20_000, 0.02)).toEqual({ status: 'NEVER' }); // igual al interés
    expect(projectPayoff(1_000, 0, 0)).toEqual({ status: 'NEVER' });
  });

  it('respeta el tope de meses: CAPPED', () => {
    expect(projectPayoff(1_000_000, 20_001, 0.02, 12)).toEqual({ status: 'CAPPED' });
  });

  it('saldo cero: 0 meses', () => {
    expect(projectPayoff(0, 100, 0.05)).toEqual({
      status: 'PAYABLE',
      months: 0,
      totalPaid: 0,
      totalInterest: 0,
    });
  });

  it('cuota mayor al saldo: un solo pago por saldo + interés', () => {
    const p = projectPayoff(1_000, 5_000, 0.1);
    expect(p).toEqual({ status: 'PAYABLE', months: 1, totalPaid: 1_100, totalInterest: 100 });
  });

  it('rechaza entradas no finitas o tasa negativa', () => {
    expect(() => projectPayoff(Number.NaN, 1, 0)).toThrow(RangeError);
    expect(() => projectPayoff(100, 10, -0.1)).toThrow(RangeError);
  });
});

describe('meses restantes sin tasa y regla del diseño', () => {
  it('monthsWithoutRate = ceil(saldo / cuota)', () => {
    expect(monthsWithoutRate(1_000, 300)).toBe(4);
    expect(monthsWithoutRate(900, 300)).toBe(3);
    expect(monthsWithoutRate(0, 300)).toBe(0);
    expect(monthsWithoutRate(900, 0)).toBeNull();
  });

  it('sin cuota: null', () => {
    expect(
      remainingMonths({ saldo: 900, cuota: null, tasa: null, totalCount: 10, paidCount: 0 }),
    ).toBeNull();
  });

  it('sin tasa ni plazo: ceil(saldo/cuota)', () => {
    expect(
      remainingMonths({ saldo: 1_000, cuota: 300, tasa: null, totalCount: null, paidCount: 2 }),
    ).toBe(4);
  });

  it('con plazo: max(totalCount - paidCount, ceil(saldo/cuota))', () => {
    // total-paid = 8 gana sobre ceil(500/100) = 5
    expect(
      remainingMonths({ saldo: 500, cuota: 100, tasa: null, totalCount: 10, paidCount: 2 }),
    ).toBe(8);
    // ceil = 9 gana sobre total-paid = 8
    expect(
      remainingMonths({ saldo: 900, cuota: 100, tasa: null, totalCount: 10, paidCount: 2 }),
    ).toBe(9);
  });

  it('con tasa usa projectPayoff', () => {
    const r = estimateMonthlyRate(1_200_000, 180_000, 10) as number;
    expect(
      remainingMonths({ saldo: 1_200_000, cuota: 180_000, tasa: r, totalCount: 10, paidCount: 0 }),
    ).toBe(10);
    // Sin plazo conocido (tasa conocida): 1.000.000 al 2% con cuota 20.001 no es viable en 600 meses
    expect(
      remainingMonths({ saldo: 1_000_000, cuota: 20_000, tasa: 0.02, totalCount: null, paidCount: 0 }),
    ).toBeNull();
  });

  it('con tasa conocida devuelve solo la simulacion con interes, sin max contra el plan', () => {
    // Saldo menor al de un plan bien configurado: antes 24 (plan 36 - 12 pagados), ahora la simulacion.
    expect(
      remainingMonths({ saldo: 934_953, cuota: 100_000, tasa: 0.018, totalCount: 36, paidCount: 12 }),
    ).toBe(11);
    // Antes 4 (6 - 2), ahora 1.
    expect(
      remainingMonths({ saldo: 30_000, cuota: 100_000, tasa: 0.02, totalCount: 6, paidCount: 2 }),
    ).toBe(1);
    // Prestamo bien configurado: simulacion coincide con el plan restante.
    expect(
      remainingMonths({ saldo: 1_934_953, cuota: 100_000, tasa: 0.018, totalCount: 36, paidCount: 12 }),
    ).toBe(24);
  });

  it('con tasa 0 se comporta como sin tasa (conserva el max con el plan)', () => {
    expect(
      remainingMonths({ saldo: 500, cuota: 100, tasa: 0, totalCount: 10, paidCount: 2 }),
    ).toBe(8);
  });

  it('saldo liquidado: 0', () => {
    expect(
      remainingMonths({ saldo: 0, cuota: 100, tasa: 0.02, totalCount: 10, paidCount: 3 }),
    ).toBe(0);
  });
});
