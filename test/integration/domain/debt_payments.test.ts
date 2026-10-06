import { describe, expect, it } from 'vitest';
import {
  DebtArchivedError,
  DebtSettledError,
  UseDebtPaymentFlow,
  ValidationError,
} from '../../../src/domain/services';
import { estimateMonthlyRate } from '../../../src/domain/rules/amortization';
import { available, count, expectIntegrity, localMs, mkAccount, setup, thrown } from './_helpers';

function debtWithInstallment() {
  const env = setup();
  const { d } = env;
  const acc = mkAccount(d, 'Efectivo', 1_000_000);
  const debt = d.debts.create({
    name: 'Tarjeta',
    balanceMinor: 500_000,
    installmentMinor: 100_000,
    rate: { known: 0.02 },
    nextDueDate: '2026-03-15',
  }).result;
  return { env, d, acc, debtId: debt.id, recurringId: debt.recurringId as string };
}

describe('Pagar una cuota (escenario 1, a)', () => {
  it('baja la cuenta, sube gastoDeuda (no gastoVida), baja la deuda, sube paidCount y avanza el recurrente', () => {
    const { d, acc, debtId, recurringId } = debtWithInstallment();
    expect(d.debts.get(debtId)).toMatchObject({ balanceMinor: 500_000, paidCount: 0, nextDueDate: '2026-03-15' });

    const { result, effects } = d.debts.registerPayment({
      debtId,
      accountId: acc,
      amountMinor: 100_000,
      type: 'INSTALLMENT',
    });

    expect(result).toMatchObject({
      principalAppliedMinor: 100_000,
      overpaymentMinor: 0,
      newBalanceMinor: 400_000,
      linkedToOccurrence: true,
    });
    expect(available(d, acc)).toBe(900_000);
    const s = d.reports.monthStatementOf();
    expect(s.gastoDeuda).toBe(100_000);
    expect(s.gastoVida).toBe(0);
    expect(s.gastoTotal).toBe(100_000);
    expect(d.debts.get(debtId)).toMatchObject({ balanceMinor: 400_000, paidCount: 1, nextDueDate: '2026-04-15' });
    const tx = d.transactions.get(result.transactionId);
    expect(tx).toMatchObject({
      type: 'EXPENSE',
      kind: 'DEBT_PAYMENT',
      debtId,
      debtPaymentType: 'INSTALLMENT',
      debtPrincipalAppliedMinor: 100_000,
      recurringItemId: recurringId,
      occurrenceDate: '2026-03-15',
    });
    expect(effects.refresh).toEqual(expect.arrayContaining(['accounts', 'transactions', 'debts', 'statement', 'recurring']));
    expect(effects.reschedule).toEqual([recurringId]);
    expectIntegrity(d);
  });

  it('un pago EXTRA no se liga al recurrente ni suma a paidCount', () => {
    const { d, acc, debtId } = debtWithInstallment();
    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 50_000, type: 'EXTRA' });
    expect(d.debts.get(debtId)).toMatchObject({ balanceMinor: 450_000, paidCount: 0, nextDueDate: '2026-03-15' });
    expectIntegrity(d);
  });

  it('el paidCount suma initialPaidCount', () => {
    const env = setup();
    const acc = mkAccount(env.d, 'Efectivo', 1_000_000);
    const { id } = env.d.debts.create({
      name: 'Credito',
      balanceMinor: 300_000,
      installmentMinor: 100_000,
      rate: { known: 0 },
      initialPaidCount: 4,
    }).result;
    env.d.debts.registerPayment({ debtId: id, accountId: acc, amountMinor: 100_000, type: 'INSTALLMENT' });
    expect(env.d.debts.get(id)?.paidCount).toBe(5);
  });

  it('la ocurrencia siguiente salta las ya confirmadas (31 de enero -> fin de febrero, sin deriva)', () => {
    const env = setup();
    const acc = mkAccount(env.d, 'Efectivo', 5_000_000);
    const { id } = env.d.debts.create({
      name: 'Prestamo',
      balanceMinor: 1_000_000,
      installmentMinor: 100_000,
      rate: { known: 0 },
      nextDueDate: '2026-01-31',
    }).result;
    const pay = () => env.d.debts.registerPayment({ debtId: id, accountId: acc, amountMinor: 100_000, type: 'INSTALLMENT' });
    pay();
    expect(env.d.debts.get(id)?.nextDueDate).toBe('2026-02-28');
    pay();
    expect(env.d.debts.get(id)?.nextDueDate).toBe('2026-03-31');
  });
});

describe('Abono mayor al saldo (escenario 2, b)', () => {
  it('deja la deuda en 0, el gasto es el monto completo y el capital aplicado el saldo', () => {
    const { d, acc, debtId } = debtWithInstallment();
    const { result } = d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 700_000, type: 'EXTRA' });
    expect(result).toMatchObject({ principalAppliedMinor: 500_000, overpaymentMinor: 200_000, newBalanceMinor: 0 });
    expect(d.debts.get(debtId)?.balanceMinor).toBe(0);
    expect(d.transactions.get(result.transactionId)).toMatchObject({
      amountMinor: 700_000,
      debtPrincipalAppliedMinor: 500_000,
    });
    expect(d.reports.monthStatementOf().gastoDeuda).toBe(700_000);
    expect(available(d, acc)).toBe(300_000);
    expectIntegrity(d);
  });

  it('con saldo 0 el pago se rechaza (deuda liquidada) y no deja efectos', () => {
    const { env, d, acc, debtId } = debtWithInstallment();
    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 500_000, type: 'EXTRA' });
    const before = count(env, 'transactions');
    expect(thrown(() => d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 1, type: 'EXTRA' }))).toBeInstanceOf(
      DebtSettledError,
    );
    expect(count(env, 'transactions')).toBe(before);
  });

  it('upcoming excluye la cuota de una deuda liquidada (se deriva)', () => {
    const { d, acc, debtId } = debtWithInstallment();
    expect(d.recurring.upcoming().map((u) => u.debtId)).toEqual([debtId]);
    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 500_000, type: 'EXTRA' });
    expect(d.recurring.upcoming()).toEqual([]);
    expect(d.recurring.pendingOccurrences()[0]).toMatchObject({ debtId, debtSettled: true });
  });
});

describe('Validaciones de pago', () => {
  it('rechaza montos no positivos y cuentas inexistentes', () => {
    const { d, acc, debtId } = debtWithInstallment();
    expect(thrown(() => d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 0, type: 'EXTRA' }))).toBeInstanceOf(
      ValidationError,
    );
    expect(() => d.debts.registerPayment({ debtId, accountId: 'nope', amountMinor: 10, type: 'EXTRA' })).toThrow();
  });

  it('una deuda archivada no admite pagos', () => {
    const { d, acc, debtId } = debtWithInstallment();
    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 10_000, type: 'EXTRA' });
    expect(d.debts.remove(debtId).result.outcome).toBe('ARCHIVED');
    expect(thrown(() => d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 1, type: 'EXTRA' }))).toBeInstanceOf(
      DebtArchivedError,
    );
  });
});

describe('Confirmar la cuota de una deuda por el camino generico (escenario 8, h)', () => {
  it('lanza UseDebtPaymentFlow y no crea nada', () => {
    const { env, d, acc, recurringId, debtId } = debtWithInstallment();
    const err = thrown(() =>
      d.recurring.confirmOccurrence({ recurringId, occurrenceDate: '2026-03-15', accountId: acc }),
    );
    expect(err).toBeInstanceOf(UseDebtPaymentFlow);
    expect(err).toMatchObject({ code: 'USE_DEBT_PAYMENT_FLOW', debtId, recurringId });
    expect(count(env, 'transactions')).toBe(0);
    expectIntegrity(d);
  });

  it('tampoco sin cuenta: la redireccion a pago de deuda tiene prioridad', () => {
    const { d, recurringId } = debtWithInstallment();
    expect(
      thrown(() => d.recurring.confirmOccurrence({ recurringId, occurrenceDate: '2026-03-15', accountId: '' })),
    ).toBeInstanceOf(UseDebtPaymentFlow);
  });
});

describe('Crear, editar y eliminar deudas', () => {
  it('tasa estimada: bisecion con totalCount y rateSource ESTIMATED; saldo OPENING', () => {
    const env = setup();
    const { id } = env.d.debts.create({
      name: 'Libre inversion',
      balanceMinor: 120_000_000,
      installmentMinor: 18_000_000,
      rate: { unknown: { months: 10 } },
    }).result;
    const debt = env.d.debts.get(id);
    expect(debt?.rateSource).toBe('ESTIMATED');
    expect(debt?.totalCount).toBe(10);
    expect(debt?.monthlyRate).toBeCloseTo(estimateMonthlyRate(120_000_000, 18_000_000, 10) as number, 12);
    expect(debt?.monthlyRate).toBeGreaterThan(0.08);
    expect(debt?.balanceMinor).toBe(120_000_000);
    expect(count(env, 'balance_adjustments', "reason = 'OPENING' and target_type = 'DEBT'")).toBe(1);
  });

  it('tasa conocida: KNOWN y totalCount NULL; sin solucion queda UNKNOWN (SUPUESTO)', () => {
    const env = setup();
    const a = env.d.debts.create({ name: 'A', balanceMinor: 100, rate: { known: 0.02 } }).result.id;
    expect(env.d.debts.get(a)).toMatchObject({ rateSource: 'KNOWN', monthlyRate: 0.02, totalCount: null });
    const b = env.d.debts.create({
      name: 'B',
      balanceMinor: 1000,
      installmentMinor: 100,
      rate: { unknown: { months: 5 } },
    }).result.id;
    expect(env.d.debts.get(b)).toMatchObject({ rateSource: 'UNKNOWN', monthlyRate: null, totalCount: 5 });
  });

  it('con cuota y fecha crea el recurrente DEBT_INSTALLMENT; sin fecha no', () => {
    const env = setup();
    const withDate = env.d.debts.create({
      name: 'A',
      balanceMinor: 1000,
      installmentMinor: 100,
      rate: { known: 0 },
      nextDueDate: '2026-04-01',
    }).result;
    expect(withDate.recurringId).not.toBeNull();
    const without = env.d.debts.create({ name: 'B', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 } }).result;
    expect(without.recurringId).toBeNull();
    expect(count(env, 'recurring_items', "kind = 'DEBT_INSTALLMENT'")).toBe(1);
  });

  it('update: cambio de saldo es ajuste MANUAL con anterior/nuevo/delta; una fecha nueva crea o mueve el recurrente', () => {
    const { env, d, debtId, recurringId } = debtWithInstallment();
    expect(d.debts.update(debtId, { balanceMinor: 450_000 }).result.adjusted).toBe(true);
    expect(d.debts.get(debtId)?.balanceMinor).toBe(450_000);
    const row = env.sqlite
      .prepare("select previous_minor p, new_minor n, delta_minor d from balance_adjustments where reason='MANUAL' and target_type='DEBT'")
      .get() as { p: number; n: number; d: number };
    expect(row).toEqual({ p: 500_000, n: 450_000, d: -50_000 });
    expect(d.debts.update(debtId, { balanceMinor: 450_000 }).result.adjusted).toBe(false);

    d.debts.update(debtId, { nextDueDate: '2026-05-05' });
    expect(d.debts.get(debtId)).toMatchObject({ nextDueDate: '2026-05-05', recurringId });

    const noRec = d.debts.create({ name: 'Sin fecha', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 } }).result.id;
    d.debts.update(noRec, { nextDueDate: '2026-06-01' });
    expect(d.debts.get(noRec)?.nextDueDate).toBe('2026-06-01');
    const noInstallment = d.debts.create({ name: 'Sin cuota', balanceMinor: 1000, rate: { known: 0 } }).result.id;
    expect(thrown(() => d.debts.update(noInstallment, { nextDueDate: '2026-06-01' }))).toBeInstanceOf(ValidationError);
    expectIntegrity(d);
  });

  it('remove sin pagos borra deuda, ajustes y recurrente; con pagos archiva, borra el recurrente y conserva el gasto', () => {
    const { env, d, acc, debtId } = debtWithInstallment();
    const other = d.debts.create({
      name: 'Otra',
      balanceMinor: 1000,
      installmentMinor: 100,
      rate: { known: 0 },
      nextDueDate: '2026-04-01',
    }).result.id;
    expect(d.debts.remove(other).result.outcome).toBe('DELETED');
    expect(d.debts.get(other)).toBeUndefined();
    expect(count(env, 'balance_adjustments', `debt_id = '${other}'`)).toBe(0);
    expect(count(env, 'recurring_items', `debt_id = '${other}'`)).toBe(0);

    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 100_000, type: 'INSTALLMENT' });
    const gastoAntes = d.reports.monthStatementOf().gastoDeuda;
    expect(d.debts.remove(debtId).result.outcome).toBe('ARCHIVED');
    expect(d.debts.list().map((x) => x.id)).not.toContain(debtId);
    expect(count(env, 'recurring_items', `debt_id = '${debtId}'`)).toBe(0);
    expect(d.reports.monthStatementOf().gastoDeuda).toBe(gastoAntes);
    expect(d.transactions.list().find((t) => t.debtId === debtId)?.debtName).toBe('Tarjeta');
    expectIntegrity(d);
  });
});

describe('Frontera de fechas del pago', () => {
  it('un pago con fecha explicita cae en su mes', () => {
    const { d, acc, debtId } = debtWithInstallment();
    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 10_000, type: 'EXTRA', date: localMs(2026, 2, 28, 23, 59) });
    expect(d.reports.monthStatement(2026, 2).gastoDeuda).toBe(10_000);
    expect(d.reports.monthStatement(2026, 3).gastoDeuda).toBe(0);
  });
});
