// F2b-bis: targetDate, aportes, ETA (hallazgo 5) y redireccion al eliminar metas (hallazgo 6b).
import { describe, expect, it } from 'vitest';
import { localDateToEpochMs } from '../../../src/domain/dates';
import { GoalNotActiveError, RefundAccountRequiredError, ValidationError } from '../../../src/domain/services';
import { available, count, expectIntegrity, localMs, mkAccount, NOW, setup, thrown, type TestEnv } from './_helpers';

function totalVisiblePlusGoals(env: TestEnv): number {
  const goals = env.d.goals.list('ACTIVE').reduce((s, g) => s + g.savedMinor, 0);
  return env.d.accounts.summary().totalMinor + goals;
}

describe('targetDate de metas', () => {
  it('create y update escriben targetDate (medianoche local), se puede cambiar y limpiar', () => {
    const { d } = setup();
    const id = d.goals.create({ name: 'Viaje', targetMinor: 1000, targetDate: '2026-12-31' }).result.id;
    expect(d.goals.get(id)?.targetDate).toBe(localDateToEpochMs('2026-12-31'));
    d.goals.update(id, { targetDate: '2027-02-28' });
    expect(d.goals.get(id)?.targetDate).toBe(localDateToEpochMs('2027-02-28'));
    d.goals.update(id, { name: 'Viaje 2' });
    expect(d.goals.get(id)?.targetDate).toBe(localDateToEpochMs('2027-02-28'));
    d.goals.update(id, { targetDate: null });
    expect(d.goals.get(id)?.targetDate).toBeNull();
    expect(d.goals.list()[0]?.targetDate).toBeNull();
  });

  it('una meta sin targetDate lo deja en null; fechas invalidas se rechazan sin efectos', () => {
    const env = setup();
    const { d } = env;
    const id = d.goals.create({ name: 'Moto', targetMinor: 1000 }).result.id;
    expect(d.goals.get(id)?.targetDate).toBeNull();
    for (const bad of ['2026-02-30', '31/12/2026', '', 'hola', '2026-13-01']) {
      expect(thrown(() => d.goals.create({ name: 'X', targetMinor: 1, targetDate: bad }))).toBeInstanceOf(ValidationError);
      expect(thrown(() => d.goals.update(id, { targetDate: bad }))).toBeInstanceOf(ValidationError);
    }
    expect(count(env, 'goals')).toBe(1);
    expect(d.goals.get(id)?.targetDate).toBeNull();
  });

  it('una meta cerrada no admite cambiar la fecha', () => {
    const { d } = setup();
    const acc = mkAccount(d, 'E', 1000);
    const id = d.goals.create({ name: 'G', targetMinor: 100, initialMinor: 100, accountId: acc }).result.id;
    d.goals.close(id);
    expect(thrown(() => d.goals.update(id, { targetDate: '2026-12-31' }))).toBeInstanceOf(GoalNotActiveError);
  });
});

describe('Aportes de una meta', () => {
  it('contributions devuelve cuenta de origen, si esta archivada y fecha en epoch ms, en orden', () => {
    const { d } = setup();
    const a = mkAccount(d, 'Efectivo', 1_000_000);
    const b = mkAccount(d, 'Ahorros', 1_000_000, 'SAVINGS');
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 1_000_000 }).result.id;
    const t1 = localMs(2026, 1, 5);
    const t2 = localMs(2026, 2, 6);
    d.goals.contribute({ goalId, accountId: b, amountMinor: 200, date: t2 });
    d.goals.contribute({ goalId, accountId: a, amountMinor: 100, date: t1 });
    d.accounts.remove(b);
    const list = d.goals.contributions(goalId);
    expect(list.map((x) => [x.accountId, x.accountName, x.accountArchived, x.amountMinor, x.date])).toEqual([
      [a, 'Efectivo', false, 100, t1],
      [b, 'Ahorros', true, 200, t2],
    ]);
    expect(d.goals.contributions('no-existe')).toEqual([]);
  });
});

describe('ETA en GoalView (D20)', () => {
  function goalWithMonthly() {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 10_000_000);
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 1_000_000 }).result.id;
    // NOW = 2026-03-10. Ventana: 2026-01-01 .. now. 300_000 en total -> 100_000 al mes.
    d.goals.contribute({ goalId, accountId: acc, amountMinor: 100_000, date: localMs(2026, 1, 10) });
    d.goals.contribute({ goalId, accountId: acc, amountMinor: 100_000, date: localMs(2026, 2, 10) });
    d.goals.contribute({ goalId, accountId: acc, amountMinor: 100_000, date: localMs(2026, 3, 1) });
    return { env, d, acc, goalId };
  }

  it('sin targetDate: ritmo de los ultimos 3 meses con ctx.now()', () => {
    const { d, goalId } = goalWithMonthly();
    const expected = { kind: 'BY_PACE', date: '2026-10-10', monthsLeft: 7, monthlyAverageMinor: 100_000 };
    expect(d.goals.get(goalId)?.eta).toEqual(expected);
    expect(d.goals.list()[0]?.eta).toEqual(expected);
  });

  it('con targetDate gana la fecha objetivo; el reloj inyectado mueve el ETA', () => {
    const { env, d, goalId } = goalWithMonthly();
    d.goals.update(goalId, { targetDate: '2026-06-10' });
    expect(d.goals.get(goalId)?.eta).toEqual({
      kind: 'BY_TARGET_DATE', date: '2026-06-10', overdue: false, monthsLeft: 3, requiredMonthlyMinor: 233_334,
    });
    env.clock.now = localMs(2026, 7, 1);
    expect(d.goals.get(goalId)?.eta).toMatchObject({ kind: 'BY_TARGET_DATE', overdue: true, monthsLeft: 0, requiredMonthlyMinor: 700_000 });
  });

  it('sin aportes en la ventana: UNKNOWN; con aportes solo antiguos tambien', () => {
    const { env, d, goalId } = goalWithMonthly();
    env.clock.now = localMs(2026, 9, 1); // ventana: 2026-07-01 .. now; los aportes quedaron atras
    expect(d.goals.get(goalId)?.eta).toEqual({ kind: 'UNKNOWN' });
    const empty = d.goals.create({ name: 'Nueva', targetMinor: 500 }).result.id;
    expect(d.goals.get(empty)?.eta).toEqual({ kind: 'UNKNOWN' });
  });

  it('alcanzada: REACHED; los ajustes cuentan para saved pero no para el ritmo', () => {
    const { d, goalId } = goalWithMonthly();
    d.goals.update(goalId, { savedMinor: 1_000_000 });
    expect(d.goals.get(goalId)?.eta).toEqual({ kind: 'REACHED' });
    d.goals.update(goalId, { savedMinor: 600_000 }); // 300k aportes + 300k ajuste
    expect(d.goals.get(goalId)?.eta).toMatchObject({ kind: 'BY_PACE', monthsLeft: 4, monthlyAverageMinor: 100_000 });
  });

  it('una meta SPENT no tiene ETA', () => {
    const { d, acc } = goalWithMonthly();
    const id = d.goals.create({ name: 'Hecha', targetMinor: 100, initialMinor: 100, accountId: acc }).result.id;
    d.goals.close(id);
    expect(d.goals.get(id)?.eta).toBeNull();
    expect(d.goals.list('SPENT')[0]?.eta).toBeNull();
  });
});

describe('Eliminar meta con aportes de cuentas archivadas (6b)', () => {
  /** A activa (1.000.000), B (500.000, se archiva), C destino (200.000). Aportes: A 300.000, B 200.000. */
  function scenario() {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'Efectivo', 1_000_000);
    const b = mkAccount(d, 'Vieja', 500_000, 'SAVINGS');
    const c = mkAccount(d, 'Destino', 200_000);
    const goalId = d.goals.create({ name: 'Viaje', targetMinor: 2_000_000 }).result.id;
    d.goals.contribute({ goalId, accountId: a, amountMinor: 300_000 });
    d.goals.contribute({ goalId, accountId: b, amountMinor: 200_000 });
    d.accounts.remove(b); // ARCHIVE_CLOSE deja su disponible en 0
    return { env, d, a, b, c, goalId };
  }

  it('refundPreview marca las cuentas archivadas y el total que exige destino', () => {
    const { d, a, b, goalId } = scenario();
    const preview = d.goals.refundPreview(goalId);
    expect(preview.refunds.map((r) => [r.accountId, r.accountName, r.amountMinor, r.accountArchived]).sort()).toEqual(
      [[a, 'Efectivo', 300_000, false], [b, 'Vieja', 200_000, true]].sort(),
    );
    expect(preview.requiresDestinationMinor).toBe(200_000);
  });

  it('sin destino: error tipado con total y desglose; nada cambia', () => {
    const { env, d, b, goalId } = scenario();
    const before = JSON.stringify(env.sqlite.prepare('select * from balance_adjustments order by rowid').all());
    const err = thrown(() => d.goals.remove(goalId));
    expect(err).toBeInstanceOf(RefundAccountRequiredError);
    expect(err).toMatchObject({
      code: 'REFUND_ACCOUNT_REQUIRED',
      goalId,
      totalMinor: 200_000,
      byAccount: [{ accountId: b, accountName: 'Vieja', amountMinor: 200_000 }],
      invalidAccountId: null,
    });
    expect(count(env, 'goals')).toBe(1);
    expect(count(env, 'goal_contributions')).toBe(2);
    expect(JSON.stringify(env.sqlite.prepare('select * from balance_adjustments order by rowid').all())).toBe(before);
    expectIntegrity(d);
  });

  it('destino archivado, inexistente o el propio origen archivado: mismo error con invalidAccountId', () => {
    const { env, d, b, goalId } = scenario();
    const dead = mkAccount(d, 'Muerta', 10);
    d.transactions.create({ type: 'EXPENSE', accountId: dead, amountMinor: 1 });
    d.accounts.remove(dead);
    for (const refundAccountId of [b, dead, 'no-existe']) {
      const err = thrown(() => d.goals.remove(goalId, { refundAccountId }));
      expect(err).toBeInstanceOf(RefundAccountRequiredError);
      expect(err).toMatchObject({ invalidAccountId: refundAccountId, totalMinor: 200_000 });
    }
    expect(count(env, 'goals')).toBe(1);
    expectIntegrity(d);
  });

  it('con destino valido: el activo vuelve a su origen, el archivado se redirige con ARCHIVE_CLOSE + MANUAL', () => {
    const { env, d, a, b, c, goalId } = scenario();
    expect(available(d, a)).toBe(700_000);
    expect(available(d, b)).toBe(0);
    const worthBefore = totalVisiblePlusGoals(env);
    const visibleBefore = d.accounts.summary().totalMinor;
    const report = d.reports.monthStatementOf();
    const adjBefore = count(env, 'balance_adjustments');

    const { result, effects } = d.goals.remove(goalId, { refundAccountId: c });

    expect(available(d, a)).toBe(1_000_000);
    expect(available(d, c)).toBe(400_000);
    expect(available(d, b)).toBe(0); // la archivada queda como estaba
    expect(d.accounts.summary().totalMinor).toBe(visibleBefore + 300_000 + 200_000);
    expect(totalVisiblePlusGoals(env)).toBe(worthBefore); // visibles + metas se conserva
    expect(d.reports.monthStatementOf()).toEqual(report); // no es ingreso ni gasto
    expect(result.redirectedMinor).toBe(200_000);
    expect(result.refundAccountId).toBe(c);
    expect(result.refunds.map((r) => [r.accountId, r.amountMinor, r.accountArchived]).sort()).toEqual(
      [[a, 300_000, false], [b, 200_000, true]].sort(),
    );
    expect(effects.refresh).toEqual(expect.arrayContaining(['goals', 'accounts']));

    expect(count(env, 'goals')).toBe(0);
    expect(count(env, 'goal_contributions')).toBe(0);
    expect(count(env, 'balance_adjustments')).toBe(adjBefore + 2);
    const close = env.sqlite
      .prepare("select previous_minor p, new_minor n, delta_minor d from balance_adjustments where account_id = ? and reason = 'ARCHIVE_CLOSE' order by rowid desc limit 1")
      .get(b);
    expect(close).toEqual({ p: 200_000, n: 0, d: -200_000 });
    const manual = env.sqlite
      .prepare("select previous_minor p, new_minor n, delta_minor d, target_type t from balance_adjustments where account_id = ? and reason = 'MANUAL' order by rowid desc limit 1")
      .get(c);
    expect(manual).toEqual({ p: 200_000, n: 400_000, d: 200_000, t: 'ACCOUNT' });
    expectIntegrity(d);
  });

  it('solo aportes de cuentas archivadas: el total de cuentas visibles sube exactamente en X', () => {
    const env = setup();
    const { d } = env;
    const b = mkAccount(d, 'Vieja', 500_000);
    const c = mkAccount(d, 'Destino', 100_000);
    const goalId = d.goals.create({ name: 'G', targetMinor: 1_000_000, initialMinor: 400_000, accountId: b }).result.id;
    d.accounts.remove(b);
    const visible = d.accounts.summary().totalMinor;
    d.goals.remove(goalId, { refundAccountId: c });
    expect(d.accounts.summary().totalMinor).toBe(visible + 400_000);
    expect(available(d, c)).toBe(500_000);
    expect(available(d, b)).toBe(0);
    expectIntegrity(d);
  });

  it('el destino puede ser una de las cuentas activas de origen', () => {
    const { d, a, goalId } = scenario();
    d.goals.remove(goalId, { refundAccountId: a });
    expect(available(d, a)).toBe(1_200_000);
    expectIntegrity(d);
  });

  it('varias cuentas archivadas de origen: un unico destino y un ARCHIVE_CLOSE por cuenta archivada', () => {
    const env = setup();
    const { d } = env;
    const b1 = mkAccount(d, 'Vieja 1', 500_000);
    const b2 = mkAccount(d, 'Vieja 2', 500_000);
    const c = mkAccount(d, 'Destino', 0);
    const goalId = d.goals.create({ name: 'G', targetMinor: 1_000_000 }).result.id;
    d.goals.contribute({ goalId, accountId: b1, amountMinor: 100_000 });
    d.goals.contribute({ goalId, accountId: b2, amountMinor: 250_000 });
    d.accounts.remove(b1);
    d.accounts.remove(b2);
    const err = thrown(() => d.goals.remove(goalId));
    expect(err).toMatchObject({ totalMinor: 350_000 });
    expect((err as RefundAccountRequiredError).byAccount.map((x) => x.amountMinor).sort()).toEqual([100_000, 250_000]);
    d.goals.remove(goalId, { refundAccountId: c });
    expect(available(d, c)).toBe(350_000);
    expect(available(d, b1)).toBe(0);
    expect(available(d, b2)).toBe(0);
    expect(count(env, 'balance_adjustments', "reason = 'ARCHIVE_CLOSE' and delta_minor < 0")).toBeGreaterThanOrEqual(4);
    expectIntegrity(d);
  });

  it('sin aportes archivados, refundAccountId se ignora y todo vuelve al origen', () => {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'A', 1000);
    const c = mkAccount(d, 'C', 0);
    const goalId = d.goals.create({ name: 'G', targetMinor: 500, initialMinor: 400, accountId: a }).result.id;
    const adj = count(env, 'balance_adjustments');
    const { result } = d.goals.remove(goalId, { refundAccountId: c });
    expect(available(d, a)).toBe(1000);
    expect(available(d, c)).toBe(0);
    expect(result).toMatchObject({ redirectedMinor: 0, refundAccountId: null });
    expect(count(env, 'balance_adjustments')).toBe(adj);
    // Tambien con un destino invalido: no hay nada que redirigir, no se valida.
    const g2 = d.goals.create({ name: 'G2', targetMinor: 500 }).result.id;
    expect(() => d.goals.remove(g2, { refundAccountId: 'no-existe' })).not.toThrow();
    expectIntegrity(d);
  });

  it('el ajuste manual de la meta se borra junto con ella y la redireccion sigue cuadrando (I1)', () => {
    const { d, c, goalId } = scenario();
    d.goals.update(goalId, { savedMinor: 650_000 });
    d.goals.remove(goalId, { refundAccountId: c });
    expect(d.goals.list()).toEqual([]);
    expectIntegrity(d);
  });

  it('una meta SPENT sigue sin poder eliminarse aunque se pase destino', () => {
    const env = setup();
    const { d } = env;
    const a = mkAccount(d, 'A', 1000);
    const goalId = d.goals.create({ name: 'G', targetMinor: 100, initialMinor: 100, accountId: a }).result.id;
    d.goals.close(goalId);
    expect(thrown(() => d.goals.remove(goalId, { refundAccountId: a }))).toBeInstanceOf(GoalNotActiveError);
  });
});

describe('reloj de los tests', () => {
  it('NOW es 2026-03-10 (las fechas de estos tests dependen de ello)', () => {
    expect(NOW).toBe(localMs(2026, 3, 10));
  });
});
