import { describe, expect, it } from 'vitest';
import {
  GoalNotActiveError,
  GoalNotReachedError,
  InsufficientFundsError,
  ValidationError,
} from '../../../src/domain/services';
import { available, count, expectIntegrity, localMs, mkAccount, setup, thrown } from './_helpers';

function withAccounts() {
  const env = setup();
  const a = mkAccount(env.d, 'Efectivo', 1_000_000);
  const b = mkAccount(env.d, 'Ahorros', 500_000, 'SAVINGS');
  return { env, d: env.d, a, b };
}

describe('Aporte desde dos cuentas (escenario 3, c)', () => {
  it('baja el disponible de cada cuenta, no crea Transaction y el reporte no cambia', () => {
    const { env, d, a, b } = withAccounts();
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 1_000_000 }).result.id;
    const before = d.reports.monthStatementOf();
    const txBefore = count(env, 'transactions');

    const r1 = d.goals.contribute({ goalId, accountId: a, amountMinor: 300_000 });
    d.goals.contribute({ goalId, accountId: b, amountMinor: 200_000 });

    expect(available(d, a)).toBe(700_000);
    expect(available(d, b)).toBe(300_000);
    expect(count(env, 'transactions')).toBe(txBefore);
    expect(count(env, 'goal_contributions')).toBe(2);
    expect(d.reports.monthStatementOf()).toEqual(before);
    expect(d.goals.get(goalId)?.savedMinor).toBe(500_000);
    expect(r1.effects.refresh).toEqual(expect.arrayContaining(['goals', 'accounts']));
    expect(r1.effects.refresh).not.toContain('statement');
    // El total de cuentas baja, el patrimonio no (la meta lo compensa).
    expect(d.accounts.summary().totalMinor).toBe(1_000_000);
    expect(d.reports.netWorth()).toBe(1_500_000);
    expectIntegrity(d);
  });

  it('no se puede aportar mas que el disponible (y no queda efecto parcial)', () => {
    const { env, d, a } = withAccounts();
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 5_000_000 }).result.id;
    const err = thrown(() => d.goals.contribute({ goalId, accountId: a, amountMinor: 1_000_001 }));
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect(err).toMatchObject({ availableMinor: 1_000_000, requestedMinor: 1_000_001 });
    expect(count(env, 'goal_contributions')).toBe(0);
    expect(() => d.goals.contribute({ goalId, accountId: a, amountMinor: 1_000_000 })).not.toThrow();
    expect(available(d, a)).toBe(0);
  });

  it('create con ahorro inicial es un aporte (exige cuenta y respeta el disponible)', () => {
    const { env, d, a } = withAccounts();
    const { id, contributionId } = d.goals.create({ name: 'Moto', targetMinor: 900_000, initialMinor: 400_000, accountId: a }).result;
    expect(contributionId).not.toBeNull();
    expect(available(d, a)).toBe(600_000);
    expect(d.goals.get(id)?.savedMinor).toBe(400_000);
    expect(count(env, 'balance_adjustments', "target_type = 'GOAL'")).toBe(0);
    expect(thrown(() => d.goals.create({ name: 'X', targetMinor: 10, initialMinor: 5 }))).toBeInstanceOf(ValidationError);
    expect(
      thrown(() => d.goals.create({ name: 'Y', targetMinor: 10_000_000, initialMinor: 9_000_000, accountId: a })),
    ).toBeInstanceOf(InsufficientFundsError);
    expect(d.goals.list().map((g) => g.name)).toEqual(['Moto']);
    expectIntegrity(d);
  });
});

describe('Cerrar meta (escenario 4, d)', () => {
  function reachedGoal() {
    const ctx = withAccounts();
    const { d, a, b } = ctx;
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 400_000 }).result.id;
    d.goals.contribute({ goalId, accountId: a, amountMinor: 300_000 });
    d.goals.contribute({ goalId, accountId: b, amountMinor: 200_000 });
    return { ...ctx, goalId };
  }

  it('exige saved >= objetivo', () => {
    const { d, a } = withAccounts();
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 400_000 }).result.id;
    d.goals.contribute({ goalId, accountId: a, amountMinor: 100_000 });
    const err = thrown(() => d.goals.close(goalId));
    expect(err).toBeInstanceOf(GoalNotReachedError);
    expect(err).toMatchObject({ savedMinor: 100_000, targetMinor: 400_000 });
    expect(d.goals.get(goalId)?.status).toBe('ACTIVE');
  });

  it('gastoMetas sube por el saved, una sola vez; cuentas intactas; gastoTotal e Indice correctos', () => {
    const { env, d, a, b, goalId } = reachedGoal();
    // Contexto del mes: ingreso pasivo 100_000, gasto de vida 50_000, pago de deuda 50_000.
    d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 100_000, isPassive: true, description: 'Renta' });
    d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 50_000, description: 'Mercado' });
    const debtId = d.debts.create({ name: 'Tarjeta', balanceMinor: 80_000, rate: { known: 0 } }).result.id;
    d.debts.registerPayment({ debtId, accountId: a, amountMinor: 50_000, type: 'EXTRA' });
    const availBefore = [available(d, a), available(d, b)];
    const txBefore = count(env, 'transactions');
    const before = d.reports.monthStatementOf();
    expect(before.gastoMetas).toBe(0);

    const { result, effects } = d.goals.close(goalId);
    expect(result.spentAmountMinor).toBe(500_000);
    expect(effects.refresh).toEqual(expect.arrayContaining(['goals', 'statement']));

    const after = d.reports.monthStatementOf();
    expect(after.gastoMetas).toBe(500_000);
    expect(after.gastoVida).toBe(50_000);
    expect(after.gastoDeuda).toBe(50_000);
    expect(after.gastoTotal).toBe(after.gastoVida + after.gastoDeuda + after.gastoMetas);
    expect(after.gastoTotal).toBe(600_000);
    expect(after.netCashflow).toBe(100_000 - 600_000);
    expect(after.index).toEqual({ kind: 'RATIO', ratio: 100_000 / 600_000 });
    expect(before.index).toEqual({ kind: 'RATIO', ratio: 100_000 / 100_000 });
    expect([available(d, a), available(d, b)]).toEqual(availBefore);
    expect(count(env, 'transactions')).toBe(txBefore);
    // La meta cerrada guarda la foto y ya no suma al patrimonio activo.
    expect(d.goals.get(goalId)).toMatchObject({ status: 'SPENT', spentAmountMinor: 500_000, savedMinor: 500_000 });
    expectIntegrity(d);
  });

  it('un segundo cierre falla; aportes y ajustes a una meta SPENT se rechazan; el gasto no se duplica', () => {
    const { d, a, goalId } = reachedGoal();
    d.goals.close(goalId);
    expect(thrown(() => d.goals.close(goalId))).toBeInstanceOf(GoalNotActiveError);
    expect(thrown(() => d.goals.contribute({ goalId, accountId: a, amountMinor: 1 }))).toBeInstanceOf(GoalNotActiveError);
    expect(thrown(() => d.goals.update(goalId, { savedMinor: 1 }))).toBeInstanceOf(GoalNotActiveError);
    expect(thrown(() => d.goals.update(goalId, { name: 'otro' }))).toBeInstanceOf(GoalNotActiveError);
    expect(d.reports.monthStatementOf().gastoMetas).toBe(500_000);
    expectIntegrity(d);
  });

  it('gastoMetas cuenta en el mes del cierre (spentAt), no en el de los aportes', () => {
    const { env, d, goalId } = reachedGoal();
    env.clock.now = localMs(2026, 4, 2);
    d.goals.close(goalId);
    expect(d.reports.monthStatement(2026, 3).gastoMetas).toBe(0);
    expect(d.reports.monthStatement(2026, 4).gastoMetas).toBe(500_000);
    expectIntegrity(d);
  });
});

describe('Editar meta', () => {
  it('cambio de saved = ajuste MANUAL de la meta con anterior/nuevo/delta; no toca cuentas ni el reporte', () => {
    const { env, d, a } = withAccounts();
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 100_000, initialMinor: 40_000, accountId: a }).result.id;
    const availBefore = available(d, a);
    const report = d.reports.monthStatementOf();
    expect(d.goals.update(goalId, { savedMinor: 70_000, name: 'Viaje 2', targetMinor: 90_000 }).result.adjusted).toBe(true);
    expect(d.goals.get(goalId)).toMatchObject({ savedMinor: 70_000, name: 'Viaje 2', targetMinor: 90_000 });
    expect(
      env.sqlite.prepare("select previous_minor p, new_minor n, delta_minor d, reason r from balance_adjustments where target_type='GOAL'").get(),
    ).toEqual({ p: 40_000, n: 70_000, d: 30_000, r: 'MANUAL' });
    expect(available(d, a)).toBe(availBefore);
    expect(d.reports.monthStatementOf()).toEqual(report);
    expect(d.goals.update(goalId, { savedMinor: 70_000 }).result.adjusted).toBe(false);
    expect(thrown(() => d.goals.update(goalId, { savedMinor: -1 }))).toBeInstanceOf(ValidationError);
    expectIntegrity(d);
  });
});

describe('Eliminar meta (escenario 12, l)', () => {
  it('una meta activa devuelve cada aporte a su cuenta de origen y borra aportes y ajustes', () => {
    const { env, d, a, b } = withAccounts();
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 1_000_000 }).result.id;
    d.goals.contribute({ goalId, accountId: a, amountMinor: 300_000 });
    d.goals.contribute({ goalId, accountId: a, amountMinor: 100_000 });
    d.goals.contribute({ goalId, accountId: b, amountMinor: 200_000 });
    d.goals.update(goalId, { savedMinor: 650_000 });
    expect(available(d, a)).toBe(600_000);
    expect(available(d, b)).toBe(300_000);

    const preview = d.goals.refundPreview(goalId);
    expect(preview.refunds.map((p) => [p.accountName, p.amountMinor]).sort()).toEqual([['Ahorros', 200_000], ['Efectivo', 400_000]]);
    expect(preview.requiresDestinationMinor).toBe(0);

    const { result } = d.goals.remove(goalId);
    expect(result.refunds.map((r) => [r.accountId, r.amountMinor]).sort()).toEqual(
      [[a, 400_000], [b, 200_000]].sort(),
    );
    expect(available(d, a)).toBe(1_000_000);
    expect(available(d, b)).toBe(500_000);
    expect(count(env, 'goals')).toBe(0);
    expect(count(env, 'goal_contributions')).toBe(0);
    expect(count(env, 'balance_adjustments', "target_type = 'GOAL'")).toBe(0);
    expectIntegrity(d);
  });

  it('una meta SPENT no se puede eliminar', () => {
    const { env, d, a } = withAccounts();
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 100_000, initialMinor: 100_000, accountId: a }).result.id;
    d.goals.close(goalId);
    expect(thrown(() => d.goals.remove(goalId))).toBeInstanceOf(GoalNotActiveError);
    expect(count(env, 'goals')).toBe(1);
    expect(d.reports.monthStatementOf().gastoMetas).toBe(100_000);
    expectIntegrity(d);
  });

  it('la lista distingue ACTIVE de SPENT', () => {
    const { d, a } = withAccounts();
    d.goals.create({ name: 'Activa', targetMinor: 100 });
    const done = d.goals.create({ name: 'Hecha', targetMinor: 100, initialMinor: 100, accountId: a }).result.id;
    d.goals.close(done);
    expect(d.goals.list('ACTIVE').map((g) => g.name)).toEqual(['Activa']);
    expect(d.goals.list('SPENT').map((g) => g.name)).toEqual(['Hecha']);
  });
});
