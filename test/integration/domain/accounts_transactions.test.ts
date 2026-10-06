import { describe, expect, it } from 'vitest';
import { AccountArchivedError, NotFoundError, ValidationError } from '../../../src/domain/services';
import { available, count, expectIntegrity, localMs, mkAccount, setup, thrown } from './_helpers';

describe('Cuentas', () => {
  it('create con saldo inicial crea un ajuste OPENING (anterior 0) y NO cuenta como ingreso', () => {
    const env = setup();
    const id = mkAccount(env.d, 'Efectivo', 250_000);
    expect(available(env.d, id)).toBe(250_000);
    expect(
      env.sqlite.prepare('select previous_minor p, new_minor n, delta_minor d, reason r from balance_adjustments').get(),
    ).toEqual({ p: 0, n: 250_000, d: 250_000, r: 'OPENING' });
    expect(env.d.reports.monthStatementOf().ingresoTotal).toBe(0);
    mkAccount(env.d, 'Vacia', 0);
    expect(count(env, 'balance_adjustments')).toBe(1);
    expectIntegrity(env.d);
  });

  it('update de saldo (escenario 5, e): ajuste MANUAL con anterior, nuevo y delta; no cuenta en el reporte; delta 0 no hace nada', () => {
    const env = setup();
    const { d } = env;
    const id = mkAccount(d, 'Efectivo', 100_000);
    d.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 30_000 });
    const report = d.reports.monthStatementOf();
    expect(available(d, id)).toBe(70_000);

    const res = d.accounts.update(id, { balanceMinor: 120_000 });
    expect(res.result.adjusted).toBe(true);
    expect(available(d, id)).toBe(120_000);
    expect(
      env.sqlite
        .prepare("select previous_minor p, new_minor n, delta_minor d from balance_adjustments where reason = 'MANUAL'")
        .get(),
    ).toEqual({ p: 70_000, n: 120_000, d: 50_000 });
    expect(d.reports.monthStatementOf()).toEqual(report);

    expect(d.accounts.update(id, { balanceMinor: 120_000 }).result.adjusted).toBe(false);
    expect(count(env, 'balance_adjustments', "reason = 'MANUAL'")).toBe(1);
    // Una cuenta si puede quedar negativa (D12).
    d.accounts.update(id, { balanceMinor: -5_000 });
    expect(available(d, id)).toBe(-5_000);
    expectIntegrity(d);
  });

  it('renombrar solo toca el nombre y se refleja en las transacciones (escenario 11, k)', () => {
    const env = setup();
    const { d } = env;
    const id = mkAccount(d, 'Efectivo', 100);
    const txId = d.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 10 }).result.id;
    expect(d.transactions.get(txId)?.accountName).toBe('Efectivo');
    const res = d.accounts.update(id, { name: '  Billetera  ' });
    expect(res.result.adjusted).toBe(false);
    expect(d.transactions.get(txId)?.accountName).toBe('Billetera');
    expect(d.transactions.list()[0]?.accountName).toBe('Billetera');
    expect(count(env, 'balance_adjustments', "reason = 'MANUAL'")).toBe(0);
    expect(thrown(() => d.accounts.update(id, { name: '   ' }))).toBeInstanceOf(ValidationError);
    expectIntegrity(d);
  });

  it('archivar una cuenta con movimientos crea ARCHIVE_CLOSE y la saca de listas y total; su historial sigue en reportes (escenario 13, m)', () => {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'Efectivo', 100_000);
    const b = mkAccount(d, 'Ahorros', 50_000);
    d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 20_000, description: 'x' });
    const goalId = d.goals.create({ name: 'Meta', targetMinor: 1_000_000, initialMinor: 10_000, accountId: a }).result.id;
    const defaultsRec = d.recurring.create({
      type: 'EXPENSE', name: 'Netflix', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-20', defaultAccountId: a,
    }).result.id;
    expect(available(d, a)).toBe(110_000);
    const report = d.reports.monthStatementOf();

    const { result } = d.accounts.remove(a);
    expect(result.outcome).toBe('ARCHIVED');
    expect(
      env.sqlite.prepare("select previous_minor p, new_minor n, delta_minor d from balance_adjustments where reason = 'ARCHIVE_CLOSE'").get(),
    ).toEqual({ p: 110_000, n: 0, d: -110_000 });
    expect(available(d, a)).toBe(0);
    expect(d.accounts.summary().accounts.map((x) => x.id)).toEqual([b]);
    expect(d.accounts.summary().totalMinor).toBe(50_000);
    expect(d.reports.monthStatementOf()).toEqual(report);
    expect(d.transactions.list().some((t) => t.accountId === a)).toBe(true);
    expect(d.recurring.list().find((r) => r.id === defaultsRec)?.defaultAccountId).toBeNull();
    // No admite nuevos movimientos.
    expect(thrown(() => d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1 }))).toBeInstanceOf(AccountArchivedError);
    expect(thrown(() => d.accounts.update(a, { name: 'x' }))).toBeInstanceOf(AccountArchivedError);
    expect(d.goals.get(goalId)?.savedMinor).toBe(10_000);
    expectIntegrity(d);
  });

  it('una cuenta con disponible 0 y movimientos se archiva sin ajuste; sin movimientos se borra con sus ajustes', () => {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'Cero', 0);
    d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 10 });
    d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 10 });
    expect(d.accounts.remove(a).result.outcome).toBe('ARCHIVED');
    expect(count(env, 'balance_adjustments', "reason = 'ARCHIVE_CLOSE'")).toBe(0);

    const c = mkAccount(d, 'Sin movimientos', 5_000);
    const rec = d.recurring.create({
      type: 'EXPENSE', name: 'x', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-20', defaultAccountId: c,
    }).result.id;
    expect(d.accounts.remove(c).result.outcome).toBe('DELETED');
    expect(d.accounts.get(c)).toBeUndefined();
    expect(count(env, 'balance_adjustments', `account_id = '${c}'`)).toBe(0);
    expect(d.recurring.list().find((r) => r.id === rec)?.defaultAccountId).toBeNull();
    expect(thrown(() => d.accounts.remove(c))).toBeInstanceOf(NotFoundError);
    expectIntegrity(d);
  });

  it('una cuenta con solo aportes a metas tambien cuenta como "con movimientos"', () => {
    const env = setup();
    const a = mkAccount(env.d, 'Efectivo', 1000);
    env.d.goals.create({ name: 'Meta', targetMinor: 5000, initialMinor: 1000, accountId: a });
    expect(env.d.accounts.remove(a).result.outcome).toBe('ARCHIVED');
    expectIntegrity(env.d);
  });
});

describe('Transacciones', () => {
  it('create STANDARD: categoria nueva en linea (reutiliza si existe), valida tipo y cuenta archivada', () => {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'Efectivo', 100_000);
    const t1 = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1000, newCategoryName: ' Mascotas ' }).result.id;
    const t2 = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1000, newCategoryName: 'Mascotas' }).result.id;
    const t3 = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1000, newCategoryName: 'Comida' }).result.id;
    const v1 = d.transactions.get(t1);
    expect(v1).toMatchObject({ kind: 'STANDARD', categoryName: 'Mascotas', debtId: null, debtPaymentType: null });
    expect(d.transactions.get(t2)?.categoryId).toBe(v1?.categoryId);
    expect(d.transactions.get(t3)?.categoryId).toBe('sys_expense_1'); // reutiliza la categoria base
    expect(count(env, 'categories', "name = 'Mascotas'")).toBe(1);

    expect(thrown(() => d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 1, categoryId: 'sys_expense_1' }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1, categoryId: 'sys_expense_1', newCategoryName: 'X' }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 0 }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1.5 }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1, isPassive: true }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.create({ type: 'EXPENSE', accountId: 'nope', amountMinor: 1 }))).toBeInstanceOf(NotFoundError);
    expectIntegrity(d);
  });

  it('el ingreso pasivo suma a ingresoPasivo y activa el widget cashflow solo una vez desde NULL', () => {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'Efectivo');
    const first = d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 80_000, isPassive: true });
    expect(first.effects.refresh).toContain('settings');
    const second = d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 20_000, isPassive: false });
    expect(second.effects.refresh).not.toContain('settings');
    const s = d.reports.monthStatementOf();
    expect(s).toMatchObject({ ingresoTotal: 100_000, ingresoPasivo: 80_000, ingresoActivo: 20_000 });
    expect(d.settings.get().widgetCashflow).toBe(1);
  });

  it('remove revierte disponible, deuda y paidCount y reubica el recurrente (escenario 6, f)', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'Efectivo', 1_000_000);
    const debt = d.debts.create({
      name: 'Tarjeta', balanceMinor: 500_000, installmentMinor: 100_000, rate: { known: 0.02 }, nextDueDate: '2026-03-15',
    }).result;
    const { transactionId } = d.debts.registerPayment({
      debtId: debt.id, accountId: acc, amountMinor: 100_000, type: 'INSTALLMENT',
    }).result;
    d.recurring.snooze(debt.recurringId as string);
    expect(d.debts.get(debt.id)).toMatchObject({ balanceMinor: 400_000, paidCount: 1, nextDueDate: '2026-04-15' });

    const { effects } = d.transactions.remove(transactionId);
    expect(available(d, acc)).toBe(1_000_000);
    expect(d.debts.get(debt.id)).toMatchObject({ balanceMinor: 500_000, paidCount: 0, nextDueDate: '2026-03-15' });
    expect(d.reports.monthStatementOf().gastoDeuda).toBe(0);
    expect(d.recurring.pendingOccurrences()[0]?.snoozedUntil).toBeNull();
    expect(effects.reschedule).toEqual([debt.recurringId]);
    expect(effects.refresh).toEqual(expect.arrayContaining(['accounts', 'transactions', 'debts', 'statement', 'recurring']));
    expect(thrown(() => d.transactions.remove(transactionId))).toBeInstanceOf(NotFoundError);
    expectIntegrity(d);
  });

  it('remove de un abono mayor al saldo restituye solo el capital aplicado', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'Efectivo', 1_000_000);
    const debtId = d.debts.create({ name: 'D', balanceMinor: 100_000, rate: { known: 0 } }).result.id;
    const { transactionId } = d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 150_000, type: 'EXTRA' }).result;
    expect(d.debts.get(debtId)?.balanceMinor).toBe(0);
    d.transactions.remove(transactionId);
    expect(d.debts.get(debtId)?.balanceMinor).toBe(100_000);
    expect(available(d, acc)).toBe(1_000_000);
    expectIntegrity(d);
  });

  it('list filtra por rango, cuenta y tipo', () => {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'A');
    const b = mkAccount(d, 'B');
    d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 1, date: localMs(2026, 3, 1) });
    d.transactions.create({ type: 'INCOME', accountId: b, amountMinor: 2, date: localMs(2026, 3, 20) });
    d.transactions.create({ type: 'EXPENSE', accountId: b, amountMinor: 3, date: localMs(2026, 4, 1, 0, 0) });
    expect(d.transactions.list().map((t) => t.amountMinor)).toEqual([3, 2, 1]);
    expect(d.transactions.list({ accountId: b }).map((t) => t.amountMinor)).toEqual([3, 2]);
    expect(d.transactions.list({ type: 'INCOME' }).map((t) => t.amountMinor)).toEqual([2]);
    expect(d.transactions.list({ from: localMs(2026, 3, 1, 0, 0), to: localMs(2026, 4, 1, 0, 0) }).map((t) => t.amountMinor)).toEqual([2, 1]);
    expect(d.transactions.list({ limit: 1 })).toHaveLength(1);
  });
});
