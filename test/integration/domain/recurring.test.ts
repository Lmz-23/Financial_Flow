import { describe, expect, it } from 'vitest';
import {
  AccountRequiredError,
  NotFoundError,
  NotSupportedError,
  OccurrenceAlreadyConfirmedError,
  ValidationError,
} from '../../../src/domain/services';
import { available, count, expectIntegrity, localMs, mkAccount, setup, thrown } from './_helpers';

function monthlyRent() {
  const env = setup();
  const { d } = env;
  const acc = mkAccount(d, 'Efectivo', 2_000_000);
  const rec = d.recurring.create({
    type: 'EXPENSE', name: 'Arriendo', amountMinor: 500_000, frequency: 'MONTHLY', anchorDate: '2026-03-31', defaultAccountId: acc,
  }).result.id;
  return { env, d, acc, rec };
}

describe('Crear y actualizar recurrentes', () => {
  it('quincenal con ancla fuera de quincena se guarda NORMALIZADA (escenario n)', () => {
    const env = setup();
    const { d } = env;
    const id = d.recurring.create({ type: 'INCOME', name: 'Sueldo', amountMinor: 1_000_000, frequency: 'BIWEEKLY', anchorDate: '2026-03-10' }).result.id;
    const row = d.recurring.list().find((r) => r.id === id);
    expect(row).toMatchObject({ anchorDate: '2026-03-15', nextDueDate: '2026-03-15', frequency: 'BIWEEKLY' });

    // Ya valida (ultimo dia): se respeta, incluido febrero bisiesto.
    const id2 = d.recurring.create({ type: 'INCOME', name: 'Otro', amountMinor: 1000, frequency: 'BIWEEKLY', anchorDate: '2028-02-29' }).result.id;
    expect(d.recurring.list().find((r) => r.id === id2)?.anchorDate).toBe('2028-02-29');

    // Cambiar de frecuencia renormaliza el ancla y reubica la fecha.
    const m = d.recurring.create({ type: 'EXPENSE', name: 'Gym', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-20' }).result.id;
    d.recurring.update(m, { frequency: 'BIWEEKLY' });
    expect(d.recurring.list().find((r) => r.id === m)).toMatchObject({ anchorDate: '2026-03-15', nextDueDate: '2026-03-15' });
    d.recurring.update(m, { anchorDate: '2026-04-08' });
    expect(d.recurring.list().find((r) => r.id === m)).toMatchObject({ anchorDate: '2026-04-15', nextDueDate: '2026-04-15' });
    expectIntegrity(d);
  });

  it('sin fecha queda "sin fecha" y no aparece en proximos pagos; update puede ponerle fecha', () => {
    const env = setup();
    const { d } = env;
    const id = d.recurring.create({ type: 'EXPENSE', name: 'Luz', amountMinor: 1000, frequency: 'MONTHLY' }).result.id;
    expect(d.recurring.list()[0]).toMatchObject({ anchorDate: null, nextDueDate: null });
    expect(d.recurring.upcoming()).toEqual([]);
    d.recurring.update(id, { anchorDate: '2026-03-12' });
    expect(d.recurring.upcoming()).toHaveLength(1);
  });

  it('el ingreso recurrente pasivo activa cashflow (SUPUESTO); validaciones', () => {
    const env = setup();
    const { d } = env;
    const r = d.recurring.create({ type: 'INCOME', name: 'Arriendo local', amountMinor: 1000, isPassive: true, frequency: 'MONTHLY', anchorDate: '2026-03-12' });
    expect(r.effects.refresh).toContain('settings');
    expect(d.settings.get().widgetCashflow).toBe(1);
    expect(r.effects.reschedule).toEqual([r.result.id]);
    expect(thrown(() => d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 1, isPassive: true, frequency: 'MONTHLY' }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 0, frequency: 'MONTHLY' }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.recurring.create({ type: 'EXPENSE', name: 'x', amountMinor: 1, frequency: 'MONTHLY', anchorDate: '2026-02-30' }))).toBeInstanceOf(ValidationError);
  });

  it('las cuotas de deuda no se gestionan como recurrentes genericos', () => {
    const env = setup();
    const { d } = env;
    const debt = d.debts.create({ name: 'D', balanceMinor: 1000, installmentMinor: 100, rate: { known: 0 }, nextDueDate: '2026-03-20' }).result;
    const rid = debt.recurringId as string;
    expect(thrown(() => d.recurring.update(rid, { name: 'x' }))).toBeInstanceOf(NotSupportedError);
    expect(thrown(() => d.recurring.remove(rid))).toBeInstanceOf(NotSupportedError);
  });
});

describe('Confirmar ocurrencias', () => {
  it('crea una Transaction real con la cuenta elegida y avanza nextDueDate desde el ancla (31 -> 30 abril)', () => {
    const { d, acc, rec } = monthlyRent();
    const { result, effects } = d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: acc });
    expect(d.transactions.get(result.transactionId)).toMatchObject({
      type: 'EXPENSE', kind: 'STANDARD', amountMinor: 500_000, description: 'Arriendo',
      recurringItemId: rec, occurrenceDate: '2026-03-31', accountId: acc,
    });
    expect(available(d, acc)).toBe(1_500_000);
    expect(d.reports.monthStatementOf().gastoVida).toBe(500_000);
    expect(d.recurring.list()[0]?.nextDueDate).toBe('2026-04-30');
    expect(effects.reschedule).toEqual([rec]);
    expect(effects.refresh).toEqual(expect.arrayContaining(['accounts', 'transactions', 'statement', 'recurring']));
    expectIntegrity(d);
  });

  it('confirmar limpia snoozedUntil junto con el avance de la fecha', () => {
    const { d, acc, rec } = monthlyRent();
    d.recurring.snooze(rec);
    expect(d.recurring.list()[0]?.snoozedUntil).not.toBeNull();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: acc });
    expect(d.recurring.list()[0]).toMatchObject({ nextDueDate: '2026-04-30', snoozedUntil: null });
  });

  it('la cuenta predeterminada es solo sugerencia: se puede confirmar con otra cuenta y otro monto', () => {
    const { d, acc, rec } = monthlyRent();
    const other = mkAccount(d, 'Otra', 100);
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: other, amountMinor: 510_000 });
    expect(available(d, acc)).toBe(2_000_000);
    expect(available(d, other)).toBe(100 - 510_000);
  });

  it('confirmar dos veces la misma ocurrencia falla (escenario 7, g) y no deja efectos', () => {
    const { env, d, acc, rec } = monthlyRent();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: acc });
    const err = thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: acc }));
    expect(err).toBeInstanceOf(OccurrenceAlreadyConfirmedError);
    expect(count(env, 'transactions')).toBe(1);
    expect(available(d, acc)).toBe(1_500_000);
    expectIntegrity(d);
  });

  it('el UNIQUE parcial respalda la regla aunque se evite el servicio', () => {
    const { env, d, acc, rec } = monthlyRent();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: acc });
    expect(() =>
      env.sqlite
        .prepare(
          "insert into transactions (id, user_id, account_id, type, kind, amount_minor, description, date, is_passive, recurring_item_id, occurrence_date, created_at, updated_at) values ('dup','default-user',?,'EXPENSE','STANDARD',1,'x',0,0,?,'2026-03-31',0,0)",
        )
        .run(acc, rec),
    ).toThrow(/UNIQUE/);
  });

  it('sin cuenta se rechaza (escenario 14)', () => {
    const { env, d, rec } = monthlyRent();
    // @ts-expect-error accountId es obligatorio en el contrato
    const err = thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31' }));
    expect(err).toBeInstanceOf(AccountRequiredError);
    expect(count(env, 'transactions')).toBe(0);
    expect(thrown(() => d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: '' }))).toBeInstanceOf(AccountRequiredError);
    expect(thrown(() => d.recurring.confirmOccurrence({ recurringId: 'nope', occurrenceDate: '2026-03-31', accountId: 'x' }))).toBeInstanceOf(NotFoundError);
  });

  it('un recurrente semanal avanza +7 dias desde el ancla y salta lo ya confirmado', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 100_000);
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'Aseo', amountMinor: 1000, frequency: 'WEEKLY', anchorDate: '2026-03-02' }).result.id;
    // Confirma la segunda primero: la fecha pendiente sigue siendo la primera.
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-09', accountId: acc });
    expect(d.recurring.list()[0]?.nextDueDate).toBe('2026-03-02');
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-02', accountId: acc });
    expect(d.recurring.list()[0]?.nextDueDate).toBe('2026-03-16');
  });

  it('unconfirm borra la transaccion por el unico camino de reversion y reubica nextDueDate', () => {
    const { env, d, acc, rec } = monthlyRent();
    d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: acc });
    d.recurring.snooze(rec);
    const { effects } = d.recurring.unconfirm(rec, '2026-03-31');
    expect(count(env, 'transactions')).toBe(0);
    expect(available(d, acc)).toBe(2_000_000);
    expect(d.recurring.list()[0]).toMatchObject({ nextDueDate: '2026-03-31', snoozedUntil: null });
    expect(effects.reschedule).toEqual([rec]);
    expect(thrown(() => d.recurring.unconfirm(rec, '2026-03-31'))).toBeInstanceOf(NotFoundError);
    expectIntegrity(d);
  });

  it('remove deja las transacciones con recurringItemId NULL', () => {
    const { env, d, acc, rec } = monthlyRent();
    const { transactionId } = d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-31', accountId: acc }).result;
    d.recurring.remove(rec);
    expect(d.recurring.list()).toEqual([]);
    expect(count(env, 'transactions')).toBe(1);
    expect(d.transactions.get(transactionId)?.recurringItemId).toBeNull();
    expectIntegrity(d);
  });
});

describe('snooze y upcoming', () => {
  it('snooze = dia siguiente a reminderHour (epoch ms local)', () => {
    const { d, rec } = monthlyRent();
    d.settings.setNotifications({ reminderHour: 8 });
    const { result } = d.recurring.snooze(rec);
    expect(result.snoozedUntil).toBe(localMs(2026, 3, 11, 8, 0));
    expect(d.recurring.pendingOccurrences()[0]?.snoozedUntil).toBe(localMs(2026, 3, 11, 8, 0));
  });

  it('upcoming: estado PENDING, OVERDUE y PAID; los de deuda toman nombre y monto de la deuda', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 1_000_000);
    const overdue = d.recurring.create({ type: 'EXPENSE', name: 'Vencido', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-05' }).result.id;
    const pending = d.recurring.create({ type: 'EXPENSE', name: 'Pendiente', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-20' }).result.id;
    const paid = d.recurring.create({ type: 'INCOME', name: 'Pagado', amountMinor: 1000, frequency: 'MONTHLY', anchorDate: '2026-03-08' }).result.id;
    d.debts.create({ name: 'Tarjeta Visa', balanceMinor: 10_000, installmentMinor: 2_500, rate: { known: 0 }, nextDueDate: '2026-03-25' });
    d.recurring.confirmOccurrence({ recurringId: paid, occurrenceDate: '2026-03-08', accountId: acc });

    const byId = new Map(d.recurring.upcoming().map((u) => [u.recurringId, u]));
    expect(byId.get(overdue)?.status).toBe('OVERDUE');
    expect(byId.get(pending)?.status).toBe('PENDING');
    expect(byId.get(paid)).toMatchObject({ status: 'PAID', nextDueDate: '2026-04-08' });
    const debtItem = [...byId.values()].find((u) => u.kind === 'DEBT_INSTALLMENT');
    expect(debtItem).toMatchObject({ name: 'Tarjeta Visa', amountMinor: 2_500, status: 'PENDING' });
  });
});
