import { describe, expect, it } from 'vitest';
import {
  cashflowPercent,
  computeCashflowIndex,
  computeMonthStatement,
  debtBalance,
  debtPaymentEffect,
  describeCashflowIndex,
  formatCashflowIndex,
  isFinancialFreedom,
  netWorth,
  paidCount,
  principalApplied,
} from '../../../src/domain/rules/statement';

describe('computeMonthStatement', () => {
  it('gastoTotal = vida + deuda + metas; neto = ingreso - gasto', () => {
    const s = computeMonthStatement({
      ingresoTotal: 5_000_000_00,
      ingresoPasivo: 600_000_00,
      gastoVida: 1_500_000_00,
      gastoDeuda: 400_000_00,
      gastoMetas: 100_000_00,
    });
    expect(s.ingresoActivo).toBe(4_400_000_00);
    expect(s.gastoTotal).toBe(2_000_000_00);
    expect(s.netCashflow).toBe(3_000_000_00);
    expect(s.index).toEqual({ kind: 'RATIO', ratio: 0.3 });
  });

  it('sin doble conteo: un pago de deuda suma una sola vez', () => {
    // Cuota de 180.000 registrada como gastoDeuda, no como gastoVida.
    const s = computeMonthStatement({
      ingresoTotal: 1_000_000_00,
      ingresoPasivo: 0,
      gastoVida: 200_000_00,
      gastoDeuda: 180_000_00,
      gastoMetas: 0,
    });
    expect(s.gastoTotal).toBe(380_000_00);
  });

  it('las metas cerradas entran en el gasto total y bajan el índice', () => {
    const base = { ingresoTotal: 1_000_000_00, ingresoPasivo: 100_000_00, gastoVida: 400_000_00, gastoDeuda: 100_000_00 };
    const sin = computeMonthStatement({ ...base, gastoMetas: 0 });
    const con = computeMonthStatement({ ...base, gastoMetas: 500_000_00 });
    expect(con.gastoTotal).toBe(1_000_000_00);
    expect(cashflowPercent(sin.index)).toBe(20);
    expect(cashflowPercent(con.index)).toBe(10);
  });

  it('el neto puede ser negativo', () => {
    const s = computeMonthStatement({
      ingresoTotal: 100_00,
      ingresoPasivo: 0,
      gastoVida: 300_00,
      gastoDeuda: 0,
      gastoMetas: 0,
    });
    expect(s.netCashflow).toBe(-200_00);
  });

  it('rechaza montos no enteros', () => {
    expect(() =>
      computeMonthStatement({ ingresoTotal: 1, ingresoPasivo: 0, gastoVida: 1.5, gastoDeuda: 0, gastoMetas: 0 }),
    ).toThrow(RangeError);
  });
});

describe('Índice de Flujo de Caja', () => {
  it('gastoTotal 0 con ingreso pasivo: "sin gastos"', () => {
    const idx = computeCashflowIndex(500_00, 0);
    expect(idx).toEqual({ kind: 'NO_EXPENSES' });
    expect(formatCashflowIndex(idx)).toBe('Sin gastos');
    expect(isFinancialFreedom(idx)).toBe(true);
  });

  it('gastoTotal 0 sin ingreso pasivo: sin dato', () => {
    const idx = computeCashflowIndex(0, 0);
    expect(idx).toEqual({ kind: 'NONE' });
    expect(formatCashflowIndex(idx)).toBe('—');
    expect(isFinancialFreedom(idx)).toBe(false);
    expect(describeCashflowIndex(idx)).toMatch(/Aún no tienes ingreso pasivo/);
  });

  it('ratio normal y porcentaje redondeado', () => {
    const idx = computeCashflowIndex(1, 3);
    expect(formatCashflowIndex(idx)).toBe('33%');
    expect(isFinancialFreedom(idx)).toBe(false);
    expect(describeCashflowIndex(idx)).toContain('Cuando llegue a 100%');
  });

  it('exactamente 100% y más es libertad financiera', () => {
    const exact = computeCashflowIndex(200, 200);
    expect(formatCashflowIndex(exact)).toBe('100%');
    expect(isFinancialFreedom(exact)).toBe(true);
    expect(describeCashflowIndex(exact)).toContain('libertad financiera');
    expect(describeCashflowIndex(exact)).not.toContain('Cuando llegue');
    const over = computeCashflowIndex(450, 300);
    expect(formatCashflowIndex(over)).toBe('150%');
    expect(isFinancialFreedom(over)).toBe(true);
  });

  it('99,6% muestra 100% pero aún no es libertad (se compara el ratio real)', () => {
    const idx = computeCashflowIndex(996, 1000);
    expect(formatCashflowIndex(idx)).toBe('100%');
    expect(isFinancialFreedom(idx)).toBe(false);
  });

  it('ratio 0 con gastos: 0% y mensaje de "aún no tienes"', () => {
    const idx = computeCashflowIndex(0, 1000);
    expect(formatCashflowIndex(idx)).toBe('0%');
    expect(describeCashflowIndex(idx)).toMatch(/Aún no tienes ingreso pasivo/);
  });
});

describe('deudas: capital aplicado y saldo derivado', () => {
  it('pago de cuota: baja saldo y cuenta como gasto completo', () => {
    const e = debtPaymentEffect(180_000_00, 1_200_000_00);
    expect(e).toEqual({
      principalApplied: 180_000_00,
      expense: 180_000_00,
      overpayment: 0,
      newBalance: 1_020_000_00,
    });
  });

  it('abono mayor al saldo: deuda en 0 y gasto completo', () => {
    const e = debtPaymentEffect(500_000_00, 120_000_00);
    expect(e.principalApplied).toBe(120_000_00);
    expect(e.expense).toBe(500_000_00);
    expect(e.overpayment).toBe(380_000_00);
    expect(e.newBalance).toBe(0);
  });

  it('abono igual al saldo: liquida sin sobrante', () => {
    const e = debtPaymentEffect(120_000_00, 120_000_00);
    expect(e.newBalance).toBe(0);
    expect(e.overpayment).toBe(0);
  });

  it('capital aplicado con saldo 0: 0, todo el pago es gasto', () => {
    expect(principalApplied(100_00, 0)).toBe(0);
    expect(debtPaymentEffect(100_00, 0).expense).toBe(100_00);
  });

  it('rechaza pagos <= 0 o no enteros', () => {
    expect(() => principalApplied(0, 100)).toThrow(RangeError);
    expect(() => principalApplied(-5, 100)).toThrow(RangeError);
    expect(() => principalApplied(1.5, 100)).toThrow(RangeError);
  });

  it('el gasto de deuda del mes nunca se duplica con el gasto de vida', () => {
    // Secuencia: apertura 300, pagos 100 y 400 (este último excede el saldo de 200).
    const p1 = debtPaymentEffect(100, 300);
    const p2 = debtPaymentEffect(400, p1.newBalance);
    const balance = debtBalance(300, p1.principalApplied + p2.principalApplied);
    expect(balance).toBe(0);
    const s = computeMonthStatement({
      ingresoTotal: 0,
      ingresoPasivo: 0,
      gastoVida: 0,
      gastoDeuda: p1.expense + p2.expense,
      gastoMetas: 0,
    });
    expect(s.gastoTotal).toBe(500);
  });

  it('debtBalance y paidCount', () => {
    expect(debtBalance(1_000, 250)).toBe(750);
    expect(paidCount(3, 2)).toBe(5);
  });
});

describe('netWorth', () => {
  it('disponible + metas - deudas', () => {
    expect(netWorth({ accountAvailable: [100, 50], goalsSaved: [30], debtBalances: [70, 10] })).toBe(100);
  });
  it('listas vacías', () => {
    expect(netWorth({ accountAvailable: [], goalsSaved: [], debtBalances: [] })).toBe(0);
  });
  it('puede ser negativo', () => {
    expect(netWorth({ accountAvailable: [10], goalsSaved: [], debtBalances: [100] })).toBe(-90);
  });
});
