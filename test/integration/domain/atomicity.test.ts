import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_ID } from '../../../src/database/seed';
import {
  AccountArchivedError,
  InsufficientFundsError,
  OccurrenceNotInSeriesError,
  RefundAccountRequiredError,
  runOperation,
} from '../../../src/domain/services';
import { available, expectIntegrity, failOn, mkAccount, NOW, setup, snapshot, thrown, type TestEnv } from './_helpers';

/** Meta con aportes de una cuenta activa y otra ARCHIVADA, y una cuenta destino. */
function goalWithArchivedSource(env: TestEnv) {
  const { d } = env;
  const a = mkAccount(d, 'A', 1000);
  const b = mkAccount(d, 'B', 1000);
  const c = mkAccount(d, 'C', 50);
  const goal = d.goals.create({ name: 'G', targetMinor: 900 }).result.id;
  d.goals.contribute({ goalId: goal, accountId: a, amountMinor: 300 });
  d.goals.contribute({ goalId: goal, accountId: b, amountMinor: 200 });
  d.accounts.remove(b);
  return { a, b, c, goal };
}

interface Case {
  name: string;
  /** Prepara datos y devuelve la operacion a ejecutar (que debe fallar a mitad). */
  prepare: (env: TestEnv) => () => unknown;
  fail: ['INSERT' | 'UPDATE' | 'DELETE', string, string?];
}

const cases: Case[] = [
  {
    name: 'AccountService.create (falla el ajuste OPENING tras insertar la cuenta)',
    prepare: ({ d }) => () => d.accounts.create({ name: 'X', type: 'CASH', openingMinor: 10 }),
    fail: ['INSERT', 'balance_adjustments'],
  },
  {
    name: 'AccountService.update (renombra y luego falla el ajuste MANUAL)',
    prepare: ({ d }) => {
      const id = mkAccount(d, 'A', 100);
      return () => d.accounts.update(id, { name: 'B', balanceMinor: 500 });
    },
    fail: ['INSERT', 'balance_adjustments', "WHEN NEW.reason = 'MANUAL'"],
  },
  {
    name: 'AccountService.remove archivando (falla ARCHIVE_CLOSE tras desvincular recurrentes)',
    prepare: ({ d }) => {
      const id = mkAccount(d, 'A', 100);
      d.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 10 });
      d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 1, frequency: 'MONTHLY', anchorDate: '2026-03-20', defaultAccountId: id });
      return () => d.accounts.remove(id);
    },
    fail: ['INSERT', 'balance_adjustments', "WHEN NEW.reason = 'ARCHIVE_CLOSE'"],
  },
  {
    name: 'AccountService.unarchive (falla el UPDATE que limpia archivedAt)',
    prepare: ({ d }) => {
      const id = mkAccount(d, 'A', 100);
      d.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 10 });
      d.accounts.remove(id);
      return () => d.accounts.unarchive(id);
    },
    fail: ['UPDATE', 'accounts', 'WHEN NEW.archived_at IS NULL'],
  },
  {
    name: 'AccountService.remove borrando (falla el DELETE de la cuenta tras borrar ajustes)',
    prepare: ({ d }) => {
      const id = mkAccount(d, 'A', 100);
      return () => d.accounts.remove(id);
    },
    fail: ['DELETE', 'accounts'],
  },
  {
    name: 'TransactionService.create con categoria nueva y pasivo (falla el insert de la transaccion)',
    prepare: ({ d }) => {
      const id = mkAccount(d, 'A', 100);
      return () => d.transactions.create({ type: 'INCOME', accountId: id, amountMinor: 10, isPassive: true, newCategoryName: 'Nueva' });
    },
    fail: ['INSERT', 'transactions'],
  },
  {
    name: 'TransactionService.remove ligada a un recurrente (falla la reubicacion de nextDueDate)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const rec = d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-20' }).result.id;
      const tx = d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: acc }).result.transactionId;
      return () => d.transactions.remove(tx);
    },
    fail: ['UPDATE', 'recurring_items'],
  },
  {
    name: 'DebtService.create (falla el recurrente vinculado tras la deuda y el ajuste)',
    prepare: ({ d }) => () =>
      d.debts.create({ name: 'D', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 }, nextDueDate: '2026-04-01' }),
    fail: ['INSERT', 'recurring_items'],
  },
  {
    name: 'DebtService.registerPayment de cuota (falla el avance de nextDueDate tras insertar el pago)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 10_000);
      const debt = d.debts.create({ name: 'D', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
      return () => d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 100, type: 'INSTALLMENT' });
    },
    fail: ['UPDATE', 'recurring_items'],
  },
  {
    name: 'DebtService.update (ajuste MANUAL y luego falla mover la fecha)',
    prepare: ({ d }) => {
      const debt = d.debts.create({ name: 'D', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
      return () => d.debts.update(debt, { name: 'E', balanceMinor: 500, nextDueDate: '2026-05-01' });
    },
    fail: ['UPDATE', 'recurring_items'],
  },
  {
    name: 'DebtService.remove archivando (falla el borrado del recurrente)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 10_000);
      const debt = d.debts.create({ name: 'D', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
      d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 100, type: 'INSTALLMENT' });
      return () => d.debts.remove(debt);
    },
    fail: ['DELETE', 'recurring_items'],
  },
  {
    name: 'GoalService.create con ahorro inicial (falla el aporte tras insertar la meta)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      return () => d.goals.create({ name: 'G', targetMinor: 500, initialMinor: 100, accountId: acc });
    },
    fail: ['INSERT', 'goal_contributions'],
  },
  {
    name: 'GoalService.update (renombra y luego falla el ajuste MANUAL)',
    prepare: ({ d }) => {
      const goal = d.goals.create({ name: 'G', targetMinor: 500 }).result.id;
      return () => d.goals.update(goal, { name: 'H', savedMinor: 50 });
    },
    fail: ['INSERT', 'balance_adjustments'],
  },
  {
    name: 'GoalService.remove (falla el DELETE de la meta tras borrar aportes y ajustes)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const goal = d.goals.create({ name: 'G', targetMinor: 500, initialMinor: 100, accountId: acc }).result.id;
      d.goals.update(goal, { savedMinor: 150 });
      return () => d.goals.remove(goal);
    },
    fail: ['DELETE', 'goals'],
  },
  {
    name: 'GoalService.update con targetDate (escribe la fecha y luego falla el ajuste MANUAL)',
    prepare: ({ d }) => {
      const goal = d.goals.create({ name: 'G', targetMinor: 500, targetDate: '2026-12-31' }).result.id;
      return () => d.goals.update(goal, { targetDate: '2027-01-31', savedMinor: 50 });
    },
    fail: ['INSERT', 'balance_adjustments'],
  },
  {
    name: 'GoalService.remove con redireccion (falla el ajuste MANUAL del destino al final)',
    prepare: (env) => {
      const { c, goal } = goalWithArchivedSource(env);
      return () => env.d.goals.remove(goal, { refundAccountId: c });
    },
    fail: ['INSERT', 'balance_adjustments', "WHEN NEW.reason = 'MANUAL'"],
  },
  {
    name: 'GoalService.remove con redireccion (falla el ARCHIVE_CLOSE tras borrar aportes y meta)',
    prepare: (env) => {
      const { c, goal } = goalWithArchivedSource(env);
      return () => env.d.goals.remove(goal, { refundAccountId: c });
    },
    // El trigger se instala despues de preparar: solo alcanza al ARCHIVE_CLOSE de la redireccion.
    fail: ['INSERT', 'balance_adjustments', "WHEN NEW.reason = 'ARCHIVE_CLOSE'"],
  },
  {
    name: 'DebtService.update con ancla sobre ocurrencias confirmadas (falla mover la fecha)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 10_000);
      const debt = d.debts.create({ name: 'D', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
      d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 100, type: 'INSTALLMENT' });
      return () => d.debts.update(debt, { balanceMinor: 500, nextDueDate: '2026-03-15' });
    },
    fail: ['UPDATE', 'recurring_items'],
  },
  {
    name: 'RecurringService.confirmOccurrence (falla el avance tras insertar la transaccion)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const rec = d.recurring.create({ type: 'INCOME', name: 'x', amountMinor: 10, isPassive: true, frequency: 'MONTHLY', anchorDate: '2026-03-20' }).result.id;
      return () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: acc });
    },
    fail: ['UPDATE', 'recurring_items'],
  },
  {
    name: 'RecurringService.unconfirm (falla la reubicacion tras borrar la transaccion)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const rec = d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-20' }).result.id;
      d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: acc });
      return () => d.recurring.unconfirm(rec, '2026-03-20');
    },
    fail: ['UPDATE', 'recurring_items'],
  },
  {
    name: 'RecurringService.remove (desvincula transacciones y luego falla el DELETE)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const rec = d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-20' }).result.id;
      d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: acc });
      return () => d.recurring.remove(rec);
    },
    fail: ['DELETE', 'recurring_items'],
  },
  {
    name: 'GoalService.close (falla el UPDATE de la meta)',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const goal = d.goals.create({ name: 'G', targetMinor: 100, initialMinor: 100, accountId: acc }).result.id;
      return () => d.goals.close(goal);
    },
    fail: ['UPDATE', 'goals', "WHEN NEW.status = 'SPENT'"],
  },
];

describe('Atomicidad real (escenario q): una operacion que falla a mitad no deja efectos parciales', () => {
  for (const c of cases) {
    it(c.name, () => {
      const env = setup();
      const run = c.prepare(env);
      const before = snapshot(env);
      failOn(env, c.fail[0], c.fail[1], c.fail[2] ?? '');
      expect(String(thrown(run))).toMatch(/boom/);
      env.sqlite.exec(`DROP TRIGGER boom_${c.fail[0]}_${c.fail[1]}`);
      expect(snapshot(env)).toBe(before);
      expectIntegrity(env.d);
    });
  }

  it('un fallo de regla despues de escribir (aporte inicial mayor al disponible) no deja la meta creada', () => {
    const env = setup();
    const acc = mkAccount(env.d, 'A', 100);
    const before = snapshot(env);
    expect(thrown(() => env.d.goals.create({ name: 'G', targetMinor: 500, initialMinor: 200, accountId: acc }))).toBeInstanceOf(
      InsufficientFundsError,
    );
    expect(snapshot(env)).toBe(before);
  });

  it('los rechazos de regla de la pasada F2b-bis no dejan efectos parciales', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'A', 1000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-15' }).result.id;
    const old = mkAccount(d, 'Vieja', 500);
    const tx = d.transactions.create({ type: 'EXPENSE', accountId: old, amountMinor: 10 }).result.id;
    d.accounts.remove(old);
    const { c, goal } = goalWithArchivedSource(env);
    const before = snapshot(env);
    expect(thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: acc }))).toBeInstanceOf(OccurrenceNotInSeriesError);
    expect(thrown(() => d.transactions.remove(tx))).toBeInstanceOf(AccountArchivedError);
    expect(thrown(() => d.goals.remove(goal))).toBeInstanceOf(RefundAccountRequiredError);
    expect(thrown(() => d.goals.remove(goal, { refundAccountId: old }))).toBeInstanceOf(RefundAccountRequiredError);
    // La cuenta destino valida (C) no recibio nada en ninguno de los rechazos.
    expect(available(d, c)).toBe(50);
    expect(snapshot(env)).toBe(before);
    expectIntegrity(d);
  });

  it('el callback de una operacion no puede ser asincrono (sin await dentro de la transaccion)', () => {
    const env = setup();
    const ctx = { db: env.db, userId: DEFAULT_USER_ID, now: () => NOW };
    const err = thrown(() => runOperation(ctx, () => Promise.resolve(1)));
    expect(err).toBeInstanceOf(TypeError);
    expect(String(err)).toMatch(/sincrona/);
  });
});
