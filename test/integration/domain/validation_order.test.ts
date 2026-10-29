// F2b-ter: orden documentado de validaciones (confirmOccurrence / registerPayment), registerPayment con
// recurrente vinculado sin fecha y la mutacion confirmar -> ancla NULL -> desmarcar.
import { describe, expect, it } from 'vitest';
import {
  AccountArchivedError,
  AccountRequiredError,
  DebtArchivedError,
  DebtSettledError,
  NotFoundError,
  OccurrenceAlreadyConfirmedError,
  OccurrenceNotInSeriesError,
  RecurringPausedError,
  RecurringWithoutDateError,
  UseDebtPaymentFlow,
  ValidationError,
} from '../../../src/domain/services';
import { available, count, expectIntegrity, mkAccount, setup, snapshot, thrown, type TestEnv } from './_helpers';

function recRow(env: TestEnv, id: string) {
  return env.sqlite.prepare('select anchor_date a, next_due_date n, status s from recurring_items where id = ?').get(id) as {
    a: string | null;
    n: string | null;
    s: string;
  };
}

describe('registerPayment INSTALLMENT con recurrente vinculado SIN fecha (F2b-ter punto 4)', () => {
  /** Deuda con cuota y recurrente vinculado; despues el recurrente queda sin ancla ni fecha (SQL: la API no lo permite). */
  function dateless() {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const debt = d.debts.create({ name: 'D', balanceMinor: 100_000, installmentMinor: 10_000, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
    const rid = d.debts.get(debt)?.recurringId as string;
    env.sqlite.prepare('update recurring_items set anchor_date = NULL, next_due_date = NULL where id = ?').run(rid);
    return { env, d, acc, debt, rid };
  }

  it('una occurrenceDate explicita (ajena) se rechaza con OccurrenceNotInSeriesError y sin efectos', () => {
    const { env, d, acc, debt, rid } = dateless();
    const before = snapshot(env);
    for (const occurrenceDate of ['2026-03-20', '2026-03-15']) {
      const err = thrown(() =>
        d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT', occurrenceDate }),
      );
      expect(err).toBeInstanceOf(OccurrenceNotInSeriesError);
      expect(err).toMatchObject({ code: 'OCCURRENCE_NOT_IN_SERIES', recurringId: rid, occurrenceDate });
    }
    expect(snapshot(env)).toBe(before);
    expectIntegrity(d);
  });

  it('sin occurrenceDate el pago se registra sin ligar a ninguna ocurrencia (como antes)', () => {
    const { env, d, acc, debt, rid } = dateless();
    const { result } = d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT' });
    expect(result).toMatchObject({ linkedToOccurrence: false, principalAppliedMinor: 10_000, newBalanceMinor: 90_000 });
    expect(count(env, 'transactions', 'recurring_item_id is null and occurrence_date is null')).toBe(1);
    expect(recRow(env, rid)).toMatchObject({ a: null, n: null });
    expect(d.debts.get(debt)?.paidCount).toBe(1);
    expectIntegrity(d);
  });

  it('un EXTRA con occurrenceDate no se valida ni se liga (no es cuota)', () => {
    const { env, d, acc, debt } = dateless();
    expect(() =>
      d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 1000, type: 'EXTRA', occurrenceDate: '2026-03-20' }),
    ).not.toThrow();
    expect(count(env, 'transactions', 'recurring_item_id is null')).toBe(1);
  });

  it('SUPUESTO: con ancla pero nextDueDate NULL, una ocurrencia explicita de la serie se liga; una ajena se rechaza', () => {
    const { env, d, acc, debt, rid } = dateless();
    env.sqlite.prepare("update recurring_items set anchor_date = '2026-03-15' where id = ?").run(rid);
    expect(
      thrown(() => d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT', occurrenceDate: '2026-03-16' })),
    ).toBeInstanceOf(OccurrenceNotInSeriesError);
    const { result } = d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT', occurrenceDate: '2026-04-15' });
    expect(result.linkedToOccurrence).toBe(true);
    expect(count(env, 'transactions', "occurrence_date = '2026-04-15'")).toBe(1);
    expectIntegrity(d);
  });
});

describe('Orden de validaciones de confirmOccurrence (un caso por par adyacente construible)', () => {
  // Orden: 1 recurrente no encontrado, 2 UseDebtPaymentFlow, 3 pausado, 4 sin fecha, 5 cuenta requerida,
  // 6 fecha valida, 7 pertenencia a la serie, 8 cuenta activa, 9 ya confirmada, 10 monto.
  // El par (1,2) no es construible (un recurrente inexistente no es una cuota de deuda): lo fija el orden
  // de lectura (el 2 necesita el recurrente cargado).
  function world() {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'Arriendo', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-15' }).result.id;
    const undated = d.recurring.create({ type: 'EXPENSE', name: 'Sin fecha', amountMinor: 1000, frequency: 'MONTHLY' }).result.id;
    return { env, d, acc, rec, undated };
  }

  function expectFirst(env: TestEnv, run: () => unknown, cls: new (...a: never[]) => Error, code: string): void {
    const before = snapshot(env);
    const err = thrown(run);
    expect(err).toBeInstanceOf(cls);
    expect(err).toMatchObject({ code });
    expect(snapshot(env)).toBe(before);
  }

  it('(1) recurrente inexistente: NotFoundError aunque lo demas este mal', () => {
    const { env, d } = world();
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: 'no-existe', occurrenceDate: 'x', accountId: '' }), NotFoundError, 'NOT_FOUND');
  });

  it('(2 antes que 3) cuota de deuda pausada: UseDebtPaymentFlow gana a RecurringPaused', () => {
    const { env, d, acc } = world();
    const debt = d.debts.create({ name: 'D', balanceMinor: 100, installmentMinor: 10, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
    const rid = d.debts.get(debt)?.recurringId as string;
    env.sqlite.prepare("update recurring_items set status = 'PAUSED' where id = ?").run(rid);
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: rid, occurrenceDate: '2026-03-15', accountId: acc }), UseDebtPaymentFlow, 'USE_DEBT_PAYMENT_FLOW');
  });

  it('(3 antes que 4) pausado y sin fecha: RecurringPaused gana a RecurringWithoutDate', () => {
    const { env, d, acc, undated } = world();
    env.sqlite.prepare("update recurring_items set status = 'PAUSED' where id = ?").run(undated);
    expect(recRow(env, undated)).toMatchObject({ a: null, s: 'PAUSED' });
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: undated, occurrenceDate: '2026-03-15', accountId: acc }), RecurringPausedError, 'RECURRING_PAUSED');
  });

  it('(4 antes que 5) sin fecha y sin cuenta: RecurringWithoutDate gana a AccountRequired', () => {
    const { env, d, undated } = world();
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: undated, occurrenceDate: '2026-03-15', accountId: '' }), RecurringWithoutDateError, 'RECURRING_WITHOUT_DATE');
  });

  it('(5 antes que 6) sin cuenta y fecha invalida: AccountRequired gana a ValidationError', () => {
    const { env, d, rec } = world();
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: 'basura', accountId: '' }), AccountRequiredError, 'ACCOUNT_REQUIRED');
  });

  it('(6 antes que 7) fecha de formato/anio invalidos (que tampoco es de la serie): ValidationError gana a OccurrenceNotInSeries', () => {
    const { env, d, acc, rec } = world();
    for (const occurrenceDate of ['2026-02-30', '0050-06-15', 'basura']) {
      expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate, accountId: acc }), ValidationError, 'VALIDATION');
    }
  });

  it('(7 antes que 8) fecha ajena a la serie y cuenta archivada: OccurrenceNotInSeries gana a AccountArchived', () => {
    const { env, d, rec } = world();
    const old = mkAccount(d, 'Vieja', 100);
    d.transactions.create({ type: 'EXPENSE', accountId: old, amountMinor: 1 });
    d.accounts.remove(old);
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-20', accountId: old }), OccurrenceNotInSeriesError, 'OCCURRENCE_NOT_IN_SERIES');
  });

  it('(8 antes que 9) ocurrencia ya confirmada y cuenta archivada (o inexistente): el error de cuenta gana', () => {
    const { env, d, acc, rec } = world();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc });
    d.accounts.remove(acc); // tiene movimientos: se archiva
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc }), AccountArchivedError, 'ACCOUNT_ARCHIVED');
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: 'no-existe' }), NotFoundError, 'NOT_FOUND');
  });

  it('(9 antes que el monto) ya confirmada y monto invalido: OccurrenceAlreadyConfirmed gana a ValidationError', () => {
    const { env, d, acc, rec } = world();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc });
    expectFirst(env, () => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc, amountMinor: 0 }), OccurrenceAlreadyConfirmedError, 'OCCURRENCE_ALREADY_CONFIRMED');
  });
});

describe('Orden de validaciones de registerPayment (un caso por par adyacente construible)', () => {
  // Orden: 1 deuda inexistente/archivada, 2 monto, 3 cuenta activa, 4 fecha (epoch ms), 5 deuda liquidada,
  // 6 occurrenceDate (INSTALLMENT con recurrente) mal formada, 7 pertenencia a la serie, 8 ya confirmada.
  function world(balanceMinor = 100_000) {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const debt = d.debts.create({ name: 'D', balanceMinor, installmentMinor: 10_000, rate: { known: 0 }, nextDueDate: '2026-03-15' }).result.id;
    return { env, d, acc, debt };
  }
  const pay = (d: TestEnv['d'], debt: string, accountId: string, extra: Record<string, unknown> = {}) => () =>
    d.debts.registerPayment({ debtId: debt, accountId, amountMinor: 10_000, type: 'INSTALLMENT', ...extra });

  function first(env: TestEnv, run: () => unknown, cls: new (...a: never[]) => Error, code: string): void {
    const before = snapshot(env);
    const err = thrown(run);
    expect(err).toBeInstanceOf(cls);
    expect(err).toMatchObject({ code });
    expect(snapshot(env)).toBe(before);
  }

  it('(1 antes que 2) deuda archivada y monto invalido: DebtArchived gana', () => {
    const { env, d, acc, debt } = world();
    d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'EXTRA' });
    d.debts.remove(debt); // con pagos: se archiva
    first(env, () => d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 0, type: 'EXTRA' }), DebtArchivedError, 'DEBT_ARCHIVED');
  });

  it('(2 antes que 3) monto invalido y cuenta archivada: ValidationError gana', () => {
    const { env, d, debt } = world();
    const old = mkAccount(d, 'Vieja', 100);
    d.transactions.create({ type: 'EXPENSE', accountId: old, amountMinor: 1 });
    d.accounts.remove(old);
    first(env, () => d.debts.registerPayment({ debtId: debt, accountId: old, amountMinor: 0, type: 'EXTRA' }), ValidationError, 'VALIDATION');
  });

  it('(3 antes que 4) cuenta archivada y fecha invalida: AccountArchived gana', () => {
    const { env, d, debt } = world();
    const old = mkAccount(d, 'Vieja', 100);
    d.transactions.create({ type: 'EXPENSE', accountId: old, amountMinor: 1 });
    d.accounts.remove(old);
    first(env, pay(d, debt, old, { date: Number.NaN }), AccountArchivedError, 'ACCOUNT_ARCHIVED');
  });

  it('(4 antes que 5) fecha invalida y deuda liquidada: ValidationError gana', () => {
    const { env, d, acc, debt } = world(0);
    first(env, pay(d, debt, acc, { date: Number.NaN }), ValidationError, 'VALIDATION');
  });

  it('(5 antes que 6) deuda liquidada y occurrenceDate mal formada: DebtSettled gana', () => {
    const { env, d, acc, debt } = world(0);
    first(env, pay(d, debt, acc, { occurrenceDate: 'basura' }), DebtSettledError, 'DEBT_SETTLED');
  });

  it('(6 antes que 7) occurrenceDate mal formada (tampoco de la serie): ValidationError gana', () => {
    const { env, d, acc, debt } = world();
    first(env, pay(d, debt, acc, { occurrenceDate: '2026-02-30' }), ValidationError, 'VALIDATION');
  });

  it('(7 antes que 8) ocurrencia ajena a la serie que ademas tiene transaccion ligada: OccurrenceNotInSeries gana', () => {
    const { env, d, acc, debt } = world();
    const rid = d.debts.get(debt)?.recurringId as string;
    // Dato "heredado" por SQL (el dominio ya no crea transacciones ligadas a fechas ajenas a la serie).
    env.sqlite
      .prepare(
        "insert into transactions (id, user_id, account_id, type, kind, amount_minor, description, date, is_passive, recurring_item_id, occurrence_date, created_at, updated_at) values ('legacy','default-user',?,'EXPENSE','STANDARD',1,'x',0,0,?,'2026-03-20',0,0)",
      )
      .run(acc, rid);
    first(env, pay(d, debt, acc, { occurrenceDate: '2026-03-20' }), OccurrenceNotInSeriesError, 'OCCURRENCE_NOT_IN_SERIES');
    // Y una ocurrencia de la serie ya pagada si es AlreadyConfirmed.
    d.debts.registerPayment({ debtId: debt, accountId: acc, amountMinor: 10_000, type: 'INSTALLMENT' });
    first(env, pay(d, debt, acc, { occurrenceDate: '2026-03-15' }), OccurrenceAlreadyConfirmedError, 'OCCURRENCE_ALREADY_CONFIRMED');
  });
});

describe('Mutacion: confirmar -> poner ancla NULL -> desmarcar (F2b-ter 5d)', () => {
  it('unconfirm con el recurrente ya sin fecha borra la transaccion y NO reubica nextDueDate', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'Arriendo', amountMinor: 100_000, frequency: 'MONTHLY', anchorDate: '2026-03-15' }).result.id;
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-15', accountId: acc });
    expect(recRow(env, rec)).toMatchObject({ a: '2026-03-15', n: '2026-04-15' });
    expect(available(d, acc)).toBe(900_000);

    d.recurring.update(rec, { anchorDate: null });
    expect(recRow(env, rec)).toMatchObject({ a: null, n: null });
    expect(count(env, 'transactions', "occurrence_date = '2026-03-15'")).toBe(1);

    d.recurring.unconfirm(rec, '2026-03-15');
    expect(count(env, 'transactions')).toBe(0);
    expect(available(d, acc)).toBe(1_000_000);
    expect(recRow(env, rec)).toMatchObject({ a: null, n: null });
    expect(d.recurring.upcoming().map((u) => u.recurringId)).not.toContain(rec);
    expectIntegrity(d);

    // Fijada de nuevo la fecha, la serie vuelve a empezar en la primera ocurrencia libre.
    d.recurring.update(rec, { anchorDate: '2026-03-15' });
    expect(recRow(env, rec)).toMatchObject({ a: '2026-03-15', n: '2026-03-15' });
    expectIntegrity(d);
  });
});
