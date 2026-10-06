// F2b-ter punto 5 (a) y (b): bordes de GoalService.remove con redireccion.
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_ID } from '../../../src/database/seed';
import { RefundAccountRequiredError } from '../../../src/domain/services';
import { available, count, expectIntegrity, mkAccount, secondUserDomain, setup, snapshot, thrown, type TestEnv } from './_helpers';

/** Meta con 300 aportados desde una cuenta que luego se archiva (queda en 0). */
function goalFromArchived(env: TestEnv) {
  const { d } = env;
  const a = mkAccount(d, 'Origen', 1000);
  const goal = d.goals.create({ name: 'G', targetMinor: 900 }).result.id;
  d.goals.contribute({ goalId: goal, accountId: a, amountMinor: 300 });
  d.accounts.remove(a);
  return { a, goal };
}

describe('destino de OTRO usuario en GoalService.remove (5a)', () => {
  it('RefundAccountRequiredError con invalidAccountId = la cuenta ajena y sin efectos (9 tablas)', () => {
    const env = setup();
    const { d } = env;
    const { a, goal } = goalFromArchived(env);
    // Segundo usuario con una cuenta ACTIVA suya (SQL directo para el usuario; la cuenta, via su dominio).
    const d2 = secondUserDomain(env);
    const foreign = d2.accounts.create({ name: 'Ajena', type: 'CASH', openingMinor: 5000 }).result.id;
    expect(d2.accounts.get(foreign)?.archivedAt).toBeNull();

    const before = snapshot(env);
    const err = thrown(() => d.goals.remove(goal, { refundAccountId: foreign }));
    expect(err).toBeInstanceOf(RefundAccountRequiredError);
    expect(err).toMatchObject({
      code: 'REFUND_ACCOUNT_REQUIRED',
      goalId: goal,
      invalidAccountId: foreign,
      totalMinor: 300,
    });
    expect((err as RefundAccountRequiredError).byAccount).toEqual([{ accountId: a, accountName: 'Origen', amountMinor: 300 }]);
    expect(snapshot(env)).toBe(before);
    expect(available(d, foreign)).toBe(5000);
    expectIntegrity(d);
    expectIntegrity(d2);
    // Con un destino propio funciona, y la cuenta ajena no se toco.
    const own = mkAccount(d, 'Propia', 0);
    d.goals.remove(goal, { refundAccountId: own });
    expect(available(d, own)).toBe(300);
    expect(available(d, foreign)).toBe(5000);
    expect(count(env, 'accounts', `user_id = '${DEFAULT_USER_ID}'`)).toBe(2);
  });
});

describe('cuenta archivada con disponible heredado distinto de 0 (5b)', () => {
  /**
   * La API no alcanza este estado (archivar siempre deja 0 y una archivada no admite ajustes): se
   * fabrica con un ajuste MANUAL por SQL directo, con previous/new/delta coherentes (I1).
   */
  function inheritedAdjustment(env: TestEnv, accountId: string, delta: number): void {
    const current = available(env.d, accountId);
    env.sqlite
      .prepare(
        "insert into balance_adjustments (id, user_id, target_type, account_id, previous_minor, new_minor, delta_minor, reason, created_at) values (?, ?, 'ACCOUNT', ?, ?, ?, ?, 'MANUAL', 0)",
      )
      .run(`heredado-${delta}`, DEFAULT_USER_ID, accountId, current, current + delta, delta);
  }

  for (const [label, inherited] of [['positivo', 250], ['negativo', -250]] as const) {
    it(`disponible heredado ${label} (${inherited}): tras eliminar la meta queda exactamente igual y se conserva I1`, () => {
      const env = setup();
      const { d } = env;
      const { a, goal } = goalFromArchived(env);
      const dest = mkAccount(d, 'Destino', 10);
      inheritedAdjustment(env, a, inherited);
      expect(available(d, a)).toBe(inherited);
      expectIntegrity(d);

      d.goals.remove(goal, { refundAccountId: dest });
      expect(available(d, a)).toBe(inherited);
      expect(available(d, dest)).toBe(310);
      expect(d.goals.list()).toEqual([]);
      expectIntegrity(d);
    });
  }

  it('lo mismo con el origen heredado sin destino explicito se rechaza (el aporte sigue siendo de la archivada)', () => {
    const env = setup();
    const { a, goal } = goalFromArchived(env);
    inheritedAdjustment(env, a, -250);
    const before = snapshot(env);
    expect(thrown(() => env.d.goals.remove(goal))).toBeInstanceOf(RefundAccountRequiredError);
    expect(snapshot(env)).toBe(before);
  });
});
