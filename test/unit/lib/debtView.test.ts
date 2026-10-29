import { describe, expect, it } from 'vitest';

import {
  MSG_ADD_INSTALLMENT,
  MSG_DEBT_SETTLED,
  MSG_INSTALLMENT_BELOW_INTEREST,
  debtDueLabel,
  debtProgress,
  debtProjection,
  debtRateLabel,
  debtsCountLabel,
} from '../../../src/lib/debtView';

describe('debtProjection', () => {
  it('saldo 0: liquidada', () => {
    expect(debtProjection({ balanceMinor: 0, installmentMinor: 5_000_000, monthsRemaining: 0 })).toBe(MSG_DEBT_SETTLED);
  });
  it('sin cuota: pide la cuota', () => {
    expect(debtProjection({ balanceMinor: 100_000_000, installmentMinor: null, monthsRemaining: null })).toBe(
      MSG_ADD_INSTALLMENT,
    );
  });
  it('cuota definida y monthsRemaining null: texto literal de la decision 38', () => {
    expect(debtProjection({ balanceMinor: 100_000_000, installmentMinor: 8_000_000, monthsRemaining: null })).toBe(
      'Tu cuota actual no alcanza a cubrir el interés mensual — la deuda no va a bajar con este pago.',
    );
    expect(MSG_INSTALLMENT_BELOW_INTEREST).toContain('no alcanza a cubrir el interés mensual');
  });
  it('con meses: cuota en COP y plural', () => {
    expect(debtProjection({ balanceMinor: 65_000_000, installmentMinor: 9_500_000, monthsRemaining: 7 })).toBe(
      'Pagando $95.000 al mes, la liquidas en 7 meses más.',
    );
    expect(debtProjection({ balanceMinor: 1_000_000, installmentMinor: 9_500_000, monthsRemaining: 1 })).toBe(
      'Pagando $95.000 al mes, la liquidas en 1 mes más.',
    );
  });
});

describe('debtProgress', () => {
  it('con plan: porcentaje y texto', () => {
    expect(debtProgress({ paidCount: 3, totalCount: 10 })).toEqual({ percent: 30, label: 'Llevas 3 de 10 pagos' });
  });
  it('pagos de mas sobre el plan: la barra no pasa de 100', () => {
    expect(debtProgress({ paidCount: 12, totalCount: 10 }).percent).toBe(100);
  });
  it('sin plan: cuenta los pagos', () => {
    expect(debtProgress({ paidCount: 0, totalCount: null })).toEqual({ percent: 0, label: 'Sin pagos registrados aún' });
    expect(debtProgress({ paidCount: 1, totalCount: null }).label).toBe('1 pago realizado');
    expect(debtProgress({ paidCount: 4, totalCount: 0 }).label).toBe('4 pagos realizados');
  });
});

describe('debtRateLabel / debtDueLabel / debtsCountLabel', () => {
  it('tasa conocida, estimada y por calcular', () => {
    expect(debtRateLabel({ monthlyRate: 0.023, rateSource: 'KNOWN' })).toBe('2,3% mensual');
    expect(debtRateLabel({ monthlyRate: 0.018_46, rateSource: 'ESTIMATED' })).toBe('1,8% mensual (estimada)');
    expect(debtRateLabel({ monthlyRate: null, rateSource: 'UNKNOWN' })).toBe('Por calcular');
  });
  it('fecha del proximo pago', () => {
    expect(debtDueLabel({ nextDueDate: '2026-10-15' })).toBe('15 oct');
    expect(debtDueLabel({ nextDueDate: null })).toBe('Sin definir');
  });
  it('contador', () => {
    expect(debtsCountLabel(1)).toBe('en 1 deuda activa');
    expect(debtsCountLabel(2)).toBe('en 2 deudas activas');
  });
});
