import { describe, expect, it } from 'vitest';
import { planNotifications } from '../../../src/domain/rules/notificationPlan';
import { accountRepository } from '../../../src/database/repositories/accountRepository';
import { debtRepository } from '../../../src/database/repositories/debtRepository';
import { goalRepository } from '../../../src/database/repositories/goalRepository';
import { recurringRepository } from '../../../src/database/repositories/recurringRepository';
import { settingsRepository } from '../../../src/database/repositories/settingsRepository';
import { transactionRepository } from '../../../src/database/repositories/transactionRepository';
import { ValidationError } from '../../../src/domain/services';
import { DEFAULT_USER_ID } from '../../../src/database/seed';
import { expectIntegrity, localMs, mkAccount, NOW, setup, thrown } from './_helpers';

describe('Mes calendario local (escenario o)', () => {
  it('la zona de los tests es America/Bogota (UTC-5)', () => {
    expect(new Date(2026, 2, 31, 23, 59).getTimezoneOffset()).toBe(300);
  });

  it('23:59 del ultimo dia y 00:00 del siguiente caen en meses distintos', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 0);
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 1_000, date: localMs(2026, 3, 31, 23, 59) });
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 2_000, date: localMs(2026, 4, 1, 0, 0) });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 50_000, isPassive: true, date: localMs(2026, 4, 30, 23, 59) });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 70_000, date: localMs(2026, 5, 1, 0, 0) });

    expect(d.reports.monthStatement(2026, 3)).toMatchObject({ gastoVida: 1_000, ingresoTotal: 0 });
    expect(d.reports.monthStatement(2026, 4)).toMatchObject({ gastoVida: 2_000, ingresoTotal: 50_000, ingresoPasivo: 50_000 });
    expect(d.reports.monthStatement(2026, 5)).toMatchObject({ gastoVida: 0, ingresoTotal: 70_000, ingresoPasivo: 0 });
    // Cruce de ano.
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 7, date: localMs(2026, 12, 31, 23, 59) });
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 9, date: localMs(2027, 1, 1, 0, 0) });
    expect(d.reports.monthStatement(2026, 12).gastoVida).toBe(7);
    expect(d.reports.monthStatement(2027, 1).gastoVida).toBe(9);
    // monthStatementOf usa el mes del instante.
    expect(d.reports.monthStatementOf(localMs(2026, 4, 15)).gastoVida).toBe(2_000);
    expect(thrown(() => d.reports.monthStatement(2026, 13))).toBeInstanceOf(ValidationError);
    expectIntegrity(d);
  });

  it('el cierre de una meta en el limite de mes cuenta en el mes de spentAt', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 100_000);
    const g1 = d.goals.create({ name: 'A', targetMinor: 10_000, initialMinor: 10_000, accountId: acc }).result.id;
    const g2 = d.goals.create({ name: 'B', targetMinor: 20_000, initialMinor: 20_000, accountId: acc }).result.id;
    env.clock.now = localMs(2026, 3, 31, 23, 59);
    d.goals.close(g1);
    env.clock.now = localMs(2026, 4, 1, 0, 0);
    d.goals.close(g2);
    expect(d.reports.monthStatement(2026, 3).gastoMetas).toBe(10_000);
    expect(d.reports.monthStatement(2026, 4).gastoMetas).toBe(20_000);
    expectIntegrity(d);
  });
});

describe('Desglose del mes (§3.2)', () => {
  it('gastoTotal = vida + deuda + metas; netCashflow e Indice; ningun hecho se cuenta dos veces', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 2_000_000);
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 400_000, isPassive: true });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 600_000 });
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 250_000 });
    const debtId = d.debts.create({ name: 'D', balanceMinor: 300_000, rate: { known: 0 } }).result.id;
    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 350_000, type: 'EXTRA' }); // sobrante 50_000
    const goalId = d.goals.create({ name: 'G', targetMinor: 100_000, initialMinor: 100_000, accountId: acc }).result.id;
    d.goals.contribute({ goalId, accountId: acc, amountMinor: 50_000 });
    d.goals.update(goalId, { savedMinor: 200_000 });
    d.accounts.update(acc, { balanceMinor: 1 });
    d.goals.close(goalId);

    const s = d.reports.monthStatementOf();
    expect(s).toEqual({
      ingresoTotal: 1_000_000,
      ingresoPasivo: 400_000,
      ingresoActivo: 600_000,
      gastoVida: 250_000,
      gastoDeuda: 350_000,
      gastoMetas: 200_000,
      gastoTotal: 800_000,
      netCashflow: 200_000,
      index: { kind: 'RATIO', ratio: 0.5 },
    });
    expectIntegrity(d);
  });

  it('sin gastos: "sin gastos" con ingreso pasivo, NONE sin nada', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E');
    expect(d.reports.monthStatementOf().index).toEqual({ kind: 'NONE' });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 10, isPassive: true });
    expect(d.reports.monthStatementOf().index).toEqual({ kind: 'NO_EXPENSES' });
  });

  it('patrimonio neto = disponible + metas activas - deudas no archivadas', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    d.goals.create({ name: 'G', targetMinor: 900_000, initialMinor: 300_000, accountId: acc });
    d.debts.create({ name: 'D', balanceMinor: 200_000, rate: { known: 0 } });
    expect(d.reports.netWorth()).toBe(700_000 + 300_000 - 200_000);
  });
});

describe('Date <-> epoch ms en la frontera de los repositorios (escenario p)', () => {
  it('todo instante que sale de los repositorios es number, y planNotifications lo consume', () => {
    const env = setup();
    const { d, db } = env;
    const acc = mkAccount(d, 'E', 100_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'Luz', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-20' }).result.id;
    d.debts.create({ name: 'Tarjeta', balanceMinor: 5000, installmentMinor: 500, rate: { known: 0 }, nextDueDate: '2026-03-22' });
    d.recurring.snooze(rec);
    const txId = d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 5, date: localMs(2026, 3, 9, 8, 30) }).result.id;
    const goalId = d.goals.create({ name: 'G', targetMinor: 10, initialMinor: 10, accountId: acc }).result.id;
    d.goals.close(goalId);
    d.onboarding.complete({ accounts: [], recurring: [], widgets: { cashflow: true, debts: true, goals: true } });

    const isMs = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    const account = accountRepository.getById(db, DEFAULT_USER_ID, acc);
    expect([account?.createdAt, account?.updatedAt, account?.archivedAt]).toEqual([NOW, NOW, null]);
    const tx = transactionRepository.getById(db, DEFAULT_USER_ID, txId);
    expect(tx?.date).toBe(localMs(2026, 3, 9, 8, 30));
    expect(isMs(tx?.createdAt)).toBe(true);
    const goal = goalRepository.getById(db, DEFAULT_USER_ID, goalId);
    expect(isMs(goal?.spentAt)).toBe(true);
    expect(goal?.targetDate).toBeNull();
    expect(isMs(recurringRepository.getById(db, DEFAULT_USER_ID, rec)?.snoozedUntil)).toBe(true);
    expect(isMs(debtRepository.list(db, DEFAULT_USER_ID)[0]?.createdAt)).toBe(true);
    expect(isMs(settingsRepository.get(db, DEFAULT_USER_ID)?.onboardingCompletedAt)).toBe(true);
    for (const row of [...transactionRepository.list(db, DEFAULT_USER_ID), ...recurringRepository.listStandard(db, DEFAULT_USER_ID)]) {
      for (const value of Object.values(row)) expect(value instanceof Date).toBe(false);
    }

    const pending = d.recurring.pendingOccurrences();
    expect(pending).toHaveLength(2);
    for (const o of pending) expect(o.snoozedUntil === null || typeof o.snoozedUntil === 'number').toBe(true);
    expect(pending.find((o) => o.recurringId === rec)?.snoozedUntil).toBe(localMs(2026, 3, 11, 9, 0));

    const plan = planNotifications(pending, d.settings.notificationSettings(), NOW);
    expect(plan.length).toBeGreaterThan(0);
    for (const n of plan) expect(typeof n.fireAt).toBe('number');
    expect(plan.map((n) => n.id)).toEqual(
      expect.arrayContaining([`rec:${rec}:2026-03-20:due`, `rec:${rec}:2026-03-20:snooze:2026-03-11`, 'weekly-summary']),
    );
    expect(plan.find((n) => n.id === `rec:${rec}:2026-03-20:due`)?.fireAt).toBe(localMs(2026, 3, 20, 9, 0));
    // La cuota de deuda se planifica hacia PAY_DEBT.
    expect(plan.some((n) => n.target?.route === 'PAY_DEBT')).toBe(true);
  });
});

describe('Detalle del flujo por periodo', () => {
  it('barras por semana, totales y desglose por categoria que suma el total', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 2_000_000);
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 500_000, newCategoryName: 'Sueldo', date: localMs(2026, 3, 1, 0, 0) });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 80_000, date: localMs(2026, 3, 9) });
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 30_000, newCategoryName: 'Servicios', description: 'Luz', date: localMs(2026, 3, 7, 23, 59) });
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 20_000, newCategoryName: 'Servicios', date: localMs(2026, 3, 31, 23, 59) });
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 5_000, date: localMs(2026, 3, 22, 0, 0) });
    const debtId = d.debts.create({ name: 'D', balanceMinor: 100_000, rate: { known: 0 } }).result.id;
    d.debts.registerPayment({ debtId, accountId: acc, amountMinor: 40_000, type: 'EXTRA' });
    // Fuera del mes: no cuenta.
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 999, date: localMs(2026, 4, 1, 0, 0) });

    const r = d.reports.periodReport({ kind: 'MONTH', year: 2026, index: 3 });
    expect(r.buckets.map((b) => [b.from, b.ingresoTotal, b.gastoTotal])).toEqual([
      ['2026-03-01', 500_000, 30_000],
      ['2026-03-08', 80_000, 40_000], // NOW = 10 mar: el abono de deuda cae en la semana 2
      ['2026-03-15', 0, 0],
      ['2026-03-22', 0, 25_000],
    ]);
    expect(r.statement).toMatchObject({ ingresoTotal: 580_000, gastoTotal: 95_000 });
    expect(r.incomeByCategory.map((l) => [l.group, l.name, l.totalMinor])).toEqual([
      ['CATEGORY', 'Sueldo', 500_000],
      ['UNCATEGORIZED', null, 80_000],
    ]);
    expect(r.expenseByCategory.map((l) => [l.group, l.name, l.totalMinor])).toEqual([
      ['CATEGORY', 'Servicios', 50_000],
      ['DEBT', null, 40_000],
      ['UNCATEGORIZED', null, 5_000],
    ]);
    const sum = (lines: { totalMinor: number }[]) => lines.reduce((a, l) => a + l.totalMinor, 0);
    expect(sum(r.incomeByCategory)).toBe(r.statement.ingresoTotal);
    expect(sum(r.expenseByCategory)).toBe(r.statement.gastoTotal);

    const q = d.reports.periodReport({ kind: 'QUARTER', year: 2026, index: 1 });
    expect(q.buckets.map((b) => b.gastoTotal)).toEqual([0, 0, 95_000]);
    expect(d.reports.periodReport({ kind: 'SEMESTER', year: 2026, index: 1 }).statement.gastoTotal).toBe(95_999);
    const y = d.reports.periodReport({ kind: 'YEAR', year: 2025, index: 1 });
    expect(y.buckets).toHaveLength(12);
    expect(y.incomeByCategory).toEqual([]);
    expect(thrown(() => d.reports.periodReport({ kind: 'QUARTER', year: 2026, index: 5 }))).toBeInstanceOf(ValidationError);
    expectIntegrity(d);
  });

  it('las metas cumplidas entran al desglose de gastos', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 100_000);
    const g = d.goals.create({ name: 'Viaje', targetMinor: 10_000, initialMinor: 10_000, accountId: acc }).result.id;
    d.goals.close(g);
    const r = d.reports.periodReport({ kind: 'YEAR', year: 2026, index: 1 });
    expect(r.expenseByCategory).toEqual([{ key: 'EXPENSE:goals', group: 'GOALS', name: null, totalMinor: 10_000 }]);
    expect(r.buckets[2].gastoTotal).toBe(10_000);
  });

  it('firstActivityDate: el primer ingreso, gasto o meta cumplida (con fecha manual hacia atras)', () => {
    const env = setup();
    const { d } = env;
    expect(d.reports.firstActivityDate()).toBeNull();
    const acc = mkAccount(d, 'E', 100_000);
    expect(d.reports.firstActivityDate()).toBeNull(); // el saldo inicial no es un movimiento
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 1_000 });
    expect(d.reports.firstActivityDate()).toBe('2026-03-10');
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 1_000, date: localMs(2025, 11, 3) });
    expect(d.reports.firstActivityDate()).toBe('2025-11-03');
  });
});
