// F2b-bis: pasada de correccion del dominio (hallazgos 1-4 y 6a).
import { describe, expect, it } from 'vitest';
import {
  AccountArchivedError,
  OccurrenceNotInSeriesError,
  RecurringPausedError,
  RecurringWithoutDateError,
  ValidationError,
} from '../../../src/domain/services';
import { available, count, expectIntegrity, localMs, mkAccount, setup, snapshot, thrown, type TestEnv } from './_helpers';

function rentSetup() {
  const env = setup();
  const { d } = env;
  const acc = mkAccount(d, 'Efectivo', 2_000_000);
  const rec = d.recurring.create({
    type: 'EXPENSE', name: 'Arriendo', amountMinor: 100_000, frequency: 'MONTHLY', anchorDate: '2026-03-15',
  }).result.id;
  return { env, d, acc, rec };
}

function recRow(env: TestEnv, id: string) {
  return env.sqlite.prepare('select anchor_date a, next_due_date n from recurring_items where id = ?').get(id) as {
    a: string | null;
    n: string | null;
  };
}

/** Inserta por SQL una transaccion ligada a una ocurrencia (datos "heredados" que el dominio ya no crea). */
function rawLinkedTx(env: TestEnv, accountId: string, recurringId: string, occurrence: string): string {
  const id = `legacy-${occurrence}`;
  env.sqlite
    .prepare(
      "insert into transactions (id, user_id, account_id, type, kind, amount_minor, description, date, is_passive, recurring_item_id, occurrence_date, created_at, updated_at) values (?,'default-user',?,'EXPENSE','STANDARD',1,'x',0,0,?,?,0,0)",
    )
    .run(id, accountId, recurringId, occurrence);
  return id;
}

describe('Hallazgo 1: la ocurrencia debe pertenecer a la serie', () => {
  it('confirmOccurrence rechaza una fecha ajena a la serie y una anterior al ancla; no deja efectos', () => {
    const { env, d, acc, rec } = rentSetup();
    for (const occurrenceDate of ['2026-03-20', '2026-03-14', '2026-02-15']) {
      const err = thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate, accountId: acc }));
      expect(err).toBeInstanceOf(OccurrenceNotInSeriesError);
      expect(err).toMatchObject({ code: 'OCCURRENCE_NOT_IN_SERIES', recurringId: rec, occurrenceDate });
    }
    expect(count(env, 'transactions')).toBe(0);
    expect(recRow(env, rec).n).toBe('2026-03-15');
    expect(available(d, acc)).toBe(2_000_000);
    expectIntegrity(d);
  });

  it('una ocurrencia valida futura se confirma y unconfirm deja nextDueDate donde estaba', () => {
    const { env, d, acc, rec } = rentSetup();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-05-15', accountId: acc });
    expect(recRow(env, rec).n).toBe('2026-03-15');
    d.recurring.unconfirm(rec, '2026-05-15');
    expect(recRow(env, rec).n).toBe('2026-03-15');
    expectIntegrity(d);
  });

  it('registerPayment INSTALLMENT rechaza una ocurrencia ajena a la serie de la deuda', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const debt = d.debts.create({ name: 'D', balanceMinor: 100_000, installmentMinor: 10_000, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
    const err = thrown(() =>
      d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT', occurrenceDate: '2026-03-20' }),
    );
    expect(err).toBeInstanceOf(OccurrenceNotInSeriesError);
    expect(count(env, 'transactions')).toBe(0);
    expect(d.debts.get(debt)?.paidCount).toBe(0);
    // Una ocurrencia valida posterior si se acepta y no mueve la fecha pendiente.
    d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT', occurrenceDate: '2026-04-15' });
    expect(d.debts.get(debt)?.nextDueDate).toBe('2026-03-15');
    expectIntegrity(d);
  });

  it('un EXTRA con occurrenceDate ajena no se liga ni se valida (no es cuota)', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const debt = d.debts.create({ name: 'D', balanceMinor: 100_000, installmentMinor: 10_000, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
    const { result } = d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 5_000, type: 'EXTRA', occurrenceDate: '2026-03-20' });
    expect(result.linkedToOccurrence).toBe(false);
  });

  it('removeTransactionIn no reubica nextDueDate en una fecha ajena a la serie (datos heredados)', () => {
    const { env, d, acc, rec } = rentSetup();
    const tx = rawLinkedTx(env, acc, rec, '2026-03-02');
    d.transactions.remove(tx);
    expect(recRow(env, rec).n).toBe('2026-03-15');
    expect(count(env, 'transactions')).toBe(0);
    expectIntegrity(d);
  });

  it('con ancla NULL, borrar una transaccion ligada nunca fija nextDueDate', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'Luz', amountMinor: 1000, frequency: 'MONTHLY' }).result.id;
    const tx = rawLinkedTx(env, acc, rec, '2026-03-20');
    d.transactions.remove(tx);
    expect(recRow(env, rec)).toEqual({ a: null, n: null });
    expect(d.recurring.upcoming()).toEqual([]);
    expectIntegrity(d);
  });

  it('cambiar el ancla deja de reubicar fechas de la serie anterior', () => {
    const { env, d, acc, rec } = rentSetup();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc });
    d.recurring.update(rec, { anchorDate: '2026-03-20' });
    expect(recRow(env, rec)).toEqual({ a: '2026-03-20', n: '2026-03-20' });
    d.recurring.unconfirm(rec, '2026-03-15');
    expect(recRow(env, rec).n).toBe('2026-03-20');
  });

  it('un recurrente SIN fecha no se puede confirmar (hay que fijar la fecha primero)', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'Luz', amountMinor: 1000, frequency: 'MONTHLY' }).result.id;
    const err = thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: acc }));
    expect(err).toBeInstanceOf(RecurringWithoutDateError);
    expect(err).toMatchObject({ code: 'RECURRING_WITHOUT_DATE', recurringId: rec });
    expect(count(env, 'transactions')).toBe(0);
    expect(recRow(env, rec)).toEqual({ a: null, n: null });
    // Fijada la fecha, ya se puede.
    d.recurring.update(rec, { anchorDate: '2026-03-20' });
    expect(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: acc })).not.toThrow();
    expectIntegrity(d);
  });
});

describe('Hallazgo 2: recurrente pausado', () => {
  it('confirmOccurrence sobre un PAUSED se rechaza sin efectos', () => {
    const { env, d, acc, rec } = rentSetup();
    env.sqlite.prepare("update recurring_items set status = 'PAUSED' where id = ?").run(rec);
    const err = thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc }));
    expect(err).toBeInstanceOf(RecurringPausedError);
    expect(err).toMatchObject({ code: 'RECURRING_PAUSED', recurringId: rec });
    expect(count(env, 'transactions')).toBe(0);
    expect(recRow(env, rec).n).toBe('2026-03-15');
    env.sqlite.prepare("update recurring_items set status = 'ACTIVE' where id = ?").run(rec);
    expect(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc })).not.toThrow();
  });
});

describe('Hallazgo 3: al fijar la fecha de una deuda, nextDueDate salta lo ya confirmado', () => {
  function paidTwice() {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const debt = d.debts.create({ name: 'D', balanceMinor: 100_000, installmentMinor: 10_000, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
    d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT' });
    d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT' });
    return { env, d, acc, debt };
  }

  it('ancla = fecha dada; nextDueDate = primera ocurrencia desde el ancla sin transaccion', () => {
    const { env, d, acc, debt } = paidTwice();
    const rid = d.debts.get(debt)?.recurringId as string;
    expect(recRow(env, rid).n).toBe('2026-05-15');
    d.debts.update(debt, { nextDueDate: '2026-03-15' });
    expect(recRow(env, rid)).toEqual({ a: '2026-03-15', n: '2026-05-15' });
    expect(d.debts.get(debt)?.nextDueDate).toBe('2026-05-15');
    // El siguiente pago de cuota ya no choca con una ocurrencia confirmada.
    const { result } = d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT' });
    expect(result.linkedToOccurrence).toBe(true);
    expect(d.debts.get(debt)?.nextDueDate).toBe('2026-06-15');
    expectIntegrity(d);
  });

  it('una fecha sin ocurrencias confirmadas se usa tal cual', () => {
    const { env, d, debt } = paidTwice();
    const rid = d.debts.get(debt)?.recurringId as string;
    d.debts.update(debt, { nextDueDate: '2026-03-10' });
    expect(recRow(env, rid)).toEqual({ a: '2026-03-10', n: '2026-03-10' });
  });
});

describe('Hallazgo 4: rango de fechas epoch ms', () => {
  const bad = [8.64e15 + 1, 1e20, -1e20, -8.64e15 - 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY];

  it('TransactionService.create rechaza instantes fuera de rango con ValidationError y sin efectos', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1000);
    for (const date of bad) {
      expect(thrown(() => d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 1, date }))).toBeInstanceOf(ValidationError);
    }
    expect(count(env, 'transactions')).toBe(0);
  });

  it('confirmOccurrence, registerPayment, contribute y create con ahorro inicial aplican el mismo criterio', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-15' }).result.id;
    const debt = d.debts.create({ name: 'D', balanceMinor: 1000, rate: { known: 0 } }).result.id;
    const goal = d.goals.create({ name: 'G', targetMinor: 1000 }).result.id;
    for (const date of [8.64e15 + 1, 1e20, -1e20]) {
      expect(thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc, date }))).toBeInstanceOf(ValidationError);
      expect(thrown(() => d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10, type: 'EXTRA', date }))).toBeInstanceOf(ValidationError);
      expect(thrown(() => d.goals.contribute({ goalId: goal, accountId: acc, amountMinor: 10, date }))).toBeInstanceOf(ValidationError);
    }
    expect(count(env, 'transactions')).toBe(0);
    expect(count(env, 'goal_contributions')).toBe(0);
  });

  it('los limites exactos del rango de Date si se aceptan', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1000);
    expect(() => d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 1, date: 8.64e15 })).not.toThrow();
    expect(() => d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 1, date: -8.64e15 })).not.toThrow();
    expect(() => d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 1, date: localMs(2026, 3, 10) })).not.toThrow();
  });
});

describe('Hallazgo 6a: una cuenta archivada no vuelve a cambiar de saldo', () => {
  function archivedWithTx() {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'Vieja', 1_000_000);
    const other = mkAccount(d, 'Otra', 1_000_000);
    const tx = d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 100_000, description: 'Mercado' }).result.id;
    expect(d.accounts.remove(acc).result.outcome).toBe('ARCHIVED');
    return { env, d, acc, other, tx };
  }

  it('TransactionService.remove de una transaccion de cuenta archivada se rechaza', () => {
    const { env, d, acc, tx } = archivedWithTx();
    const err = thrown(() => d.transactions.remove(tx));
    expect(err).toBeInstanceOf(AccountArchivedError);
    expect(err).toMatchObject({ accountId: acc });
    expect(count(env, 'transactions')).toBe(1);
    expect(available(d, acc)).toBe(0);
    expectIntegrity(d);
  });

  it('RecurringService.unconfirm con la transaccion en cuenta archivada se rechaza y la fecha no se mueve', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'Vieja', 1_000_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-15' }).result.id;
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc });
    d.accounts.remove(acc);
    expect(thrown(() => d.recurring.unconfirm(rec, '2026-03-15'))).toBeInstanceOf(AccountArchivedError);
    expect(recRow(env, rec).n).toBe('2026-04-15');
    expect(count(env, 'transactions')).toBe(1);
    expectIntegrity(d);
  });

  it('el pago de una deuda hecho desde una cuenta archivada tampoco se puede borrar', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'Vieja', 1_000_000);
    const debt = d.debts.create({ name: 'D', balanceMinor: 50_000, rate: { known: 0 } }).result.id;
    const { transactionId } = d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'EXTRA' }).result;
    d.accounts.remove(acc);
    expect(thrown(() => d.transactions.remove(transactionId))).toBeInstanceOf(AccountArchivedError);
    expect(d.debts.get(debt)?.balanceMinor).toBe(40_000);
    expectIntegrity(d);
  });

  it('resto de caminos que cambian el disponible de una cuenta archivada (cerrados)', () => {
    const { env, d, acc } = archivedWithTx();
    const goal = d.goals.create({ name: 'G', targetMinor: 100 }).result.id;
    const debt = d.debts.create({ name: 'D', balanceMinor: 1000, rate: { known: 0 } }).result.id;
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-15' }).result.id;
    const before = snapshot(env);
    // Tipo exacto y code de cada camino. `accounts.remove` sobre una archivada es otra regla ("ya esta
    // archivada": ValidationError), no AccountArchivedError.
    const attempts: [string, () => unknown, new (...a: never[]) => Error, string][] = [
      ['transactions.create', () => d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 1 }), AccountArchivedError, 'ACCOUNT_ARCHIVED'],
      ['accounts.update', () => d.accounts.update(acc, { balanceMinor: 5 }), AccountArchivedError, 'ACCOUNT_ARCHIVED'],
      ['accounts.remove', () => d.accounts.remove(acc), ValidationError, 'VALIDATION'],
      ['goals.contribute', () => d.goals.contribute({ goalId: goal, accountId: acc, amountMinor: 1 }), AccountArchivedError, 'ACCOUNT_ARCHIVED'],
      ['debts.registerPayment', () => d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 1, type: 'EXTRA' }), AccountArchivedError, 'ACCOUNT_ARCHIVED'],
      ['recurring.confirmOccurrence', () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc }), AccountArchivedError, 'ACCOUNT_ARCHIVED'],
    ];
    for (const [name, attempt, cls, code] of attempts) {
      const err = thrown(attempt);
      expect(err, name).toBeInstanceOf(cls);
      expect(err, name).toMatchObject({ code });
      if (cls === AccountArchivedError) expect(err, name).toMatchObject({ accountId: acc });
    }
    expect(snapshot(env)).toBe(before);
    expect(available(d, acc)).toBe(0);
    expectIntegrity(d);
  });
});
