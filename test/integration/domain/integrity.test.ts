import { describe, expect, it } from 'vitest';
import { expectIntegrity, mkAccount, setup, type TestEnv } from './_helpers';

/** Rompe a proposito un CHECK/FK (solo en esta conexion de prueba) para comprobar que IntegrityService lo ve. */
function withoutChecks(env: TestEnv, fn: () => void): void {
  env.sqlite.pragma('ignore_check_constraints = ON');
  env.sqlite.pragma('foreign_keys = OFF');
  try {
    fn();
  } finally {
    env.sqlite.pragma('ignore_check_constraints = OFF');
    env.sqlite.pragma('foreign_keys = ON');
  }
}

function invariants(env: TestEnv): string[] {
  return env.d.integrity.check().violations.map((v) => v.invariant);
}

describe('IntegrityService (I1-I6)', () => {
  it('una BD vacia y una con actividad coherente no tienen violaciones', () => {
    const env = setup();
    expectIntegrity(env.d);
    const { d } = env;
    const a = mkAccount(d, 'A', 500_000);
    const debt = d.debts.create({ name: 'D', balanceMinor: 100_000, installmentMinor: 10_000, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
    d.debts.registerPayment({ debtId: debt, accountId: a, amountMinor: 150_000, type: 'EXTRA' });
    const g = d.goals.create({ name: 'G', targetMinor: 100, initialMinor: 100, accountId: a }).result.id;
    d.goals.update(g, { savedMinor: 130 });
    d.goals.close(g);
    d.accounts.remove(a);
    expectIntegrity(d);
  });

  it('I1 detecta dinero que aparece o desaparece fuera del libro', () => {
    const env = setup();
    const a = mkAccount(env.d, 'A', 1000);
    expectIntegrity(env.d);
    // Meta gastada con foto distinta del ahorro real: rompe I1 e I3.
    const g = env.d.goals.create({ name: 'G', targetMinor: 10, initialMinor: 10, accountId: a }).result.id;
    env.d.goals.close(g);
    withoutChecks(env, () => env.sqlite.prepare('update goals set spent_amount_minor = 99').run());
    expect(invariants(env)).toEqual(expect.arrayContaining(['I1', 'I3']));
  });

  it('I2 detecta saldo de deuda negativo y capital fuera de rango', () => {
    const env = setup();
    const a = mkAccount(env.d, 'A', 1000);
    const debt = env.d.debts.create({ name: 'D', balanceMinor: 100, rate: { known: 0 } }).result.id;
    env.d.debts.registerPayment({ debtId: debt, accountId: a, amountMinor: 100, type: 'EXTRA' });
    expectIntegrity(env.d);
    withoutChecks(env, () => env.sqlite.prepare('update transactions set debt_principal_applied_minor = 500').run());
    const v = env.d.integrity.check().violations.filter((x) => x.invariant === 'I2');
    expect(v.length).toBe(2); // saldo negativo + capital > monto
  });

  it('I4 detecta una transaccion generica ligada a la cuota de una deuda y duplicados de ocurrencia', () => {
    const env = setup();
    const a = mkAccount(env.d, 'A', 1000);
    const debt = env.d.debts.create({ name: 'D', balanceMinor: 100, installmentMinor: 10, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result;
    expectIntegrity(env.d);
    env.sqlite
      .prepare(
        "insert into transactions (id,user_id,account_id,type,kind,amount_minor,description,date,is_passive,recurring_item_id,occurrence_date,created_at,updated_at) values ('g1','default-user',?,'EXPENSE','STANDARD',10,'x',0,0,?,'2026-03-15',0,0)",
      )
      .run(a, debt.recurringId);
    expect(invariants(env)).toEqual(['I4']);
    env.sqlite.exec('drop index uq_tx_recurring_occurrence');
    env.sqlite
      .prepare(
        "insert into transactions (id,user_id,account_id,type,kind,amount_minor,description,date,is_passive,recurring_item_id,occurrence_date,created_at,updated_at) values ('g2','default-user',?,'EXPENSE','STANDARD',10,'x',0,0,?,'2026-03-15',0,0)",
      )
      .run(a, debt.recurringId);
    expect(invariants(env).filter((i) => i === 'I4').length).toBeGreaterThanOrEqual(3);
  });

  it('I5 detecta pasivo en gasto y pago de deuda mal clasificado', () => {
    const env = setup();
    const a = mkAccount(env.d, 'A', 1000);
    env.d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 10 });
    withoutChecks(env, () => env.sqlite.prepare('update transactions set is_passive = 1').run());
    expect(invariants(env)).toEqual(['I5']);
  });

  it('I6 detecta un flag de widget invalido', () => {
    const env = setup();
    withoutChecks(env, () => env.sqlite.prepare('update users set widget_goals = 7').run());
    expect(invariants(env)).toEqual(['I6']);
  });
});
