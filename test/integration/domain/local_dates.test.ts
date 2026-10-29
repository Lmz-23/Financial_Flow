// F2b-ter punto 3: fechas 'YYYY-MM-DD' con anio < 100 se rechazan en el borde del servicio
// (new Date(y, ...) interpreta 0-99 como 1900-1999 y las guardaria como otra fecha).
import { describe, expect, it } from 'vitest';
import { localDateToEpochMs, toLocalDate } from '../../../src/domain/dates';
import { ValidationError } from '../../../src/domain/services';
import { expectIntegrity, mkAccount, setup, snapshot, thrown, type TestEnv } from './_helpers';

const BAD = ['0000-01-01', '0050-06-15', '0099-12-31'];

/** Cada punto de entrada de fechas LocalDate de los servicios: `prepare` deja datos y devuelve la operacion. */
const entryPoints: { name: string; prepare: (env: TestEnv) => (date: string) => unknown }[] = [
  { name: 'GoalService.create targetDate', prepare: ({ d }) => (date) => d.goals.create({ name: 'G', targetMinor: 100, targetDate: date }) },
  {
    name: 'GoalService.update targetDate',
    prepare: ({ d }) => {
      const id = d.goals.create({ name: 'G0', targetMinor: 100 }).result.id;
      return (date) => d.goals.update(id, { targetDate: date });
    },
  },
  {
    name: 'DebtService.create nextDueDate',
    prepare: ({ d }) => (date) =>
      d.debts.create({ name: 'D', balanceMinor: 100, installmentMinor: 10, rate: { known: 0 }, nextDueDate: date }),
  },
  {
    name: 'DebtService.update nextDueDate (recurrente existente)',
    prepare: ({ d }) => {
      const id = d.debts.create({ name: 'D0', balanceMinor: 100, installmentMinor: 10, rate: { known: 0 }, nextDueDate: '2026-04-01' }).result.id;
      return (date) => d.debts.update(id, { nextDueDate: date });
    },
  },
  {
    name: 'DebtService.update nextDueDate (crea el recurrente)',
    prepare: ({ d }) => {
      const id = d.debts.create({ name: 'D0', balanceMinor: 100, installmentMinor: 10, rate: { known: 0 } }).result.id;
      return (date) => d.debts.update(id, { nextDueDate: date });
    },
  },
  {
    name: 'DebtService.registerPayment occurrenceDate',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const id = d.debts.create({ name: 'D0', balanceMinor: 100, installmentMinor: 10, rate: { known: 0 }, nextDueDate: '2026-04-01' }).result.id;
      return (date) => d.debts.registerPayment({ debtId: id, accountId: acc, amountMinor: 10, type: 'INSTALLMENT', occurrenceDate: date });
    },
  },
  {
    name: 'RecurringService.create anchorDate',
    prepare: ({ d }) => (date) => d.recurring.create({ type: 'EXPENSE', name: 'R', amountMinor: 1, frequency: 'MONTHLY', anchorDate: date }),
  },
  {
    name: 'RecurringService.update anchorDate',
    prepare: ({ d }) => {
      const id = d.recurring.create({ type: 'EXPENSE', name: 'R0', amountMinor: 1, frequency: 'MONTHLY' }).result.id;
      return (date) => d.recurring.update(id, { anchorDate: date });
    },
  },
  {
    name: 'RecurringService.confirmOccurrence occurrenceDate',
    prepare: ({ d }) => {
      const acc = mkAccount(d, 'A', 1000);
      const id = d.recurring.create({ type: 'EXPENSE', name: 'R0', amountMinor: 1, frequency: 'MONTHLY', anchorDate: '2026-04-01' }).result.id;
      return (date) => d.recurring.confirmOccurrence({ recurringId: id, occurrenceDate: date, accountId: acc });
    },
  },
  {
    name: 'OnboardingService.complete (anchorDate de un recurrente)',
    prepare: ({ d }) => (date) =>
      d.onboarding.complete({
        accounts: [{ name: 'Efectivo', type: 'CASH', openingMinor: 100 }],
        recurring: [{ type: 'EXPENSE', name: 'R', amountMinor: 1, frequency: 'MONTHLY', anchorDate: date }],
        widgets: { cashflow: true, debts: true, goals: true },
      }),
  },
];

describe('Anio < 100 en fechas LocalDate: ValidationError en el borde, sin efectos', () => {
  for (const ep of entryPoints) {
    it(`${ep.name}: '0000-01-01', '0050-06-15' y '0099-12-31' se rechazan sin efectos`, () => {
      for (const date of BAD) {
        const env = setup();
        const run = ep.prepare(env);
        const before = snapshot(env);
        const err = thrown(() => run(date));
        expect(err, `${ep.name} ${date}`).toBeInstanceOf(ValidationError);
        expect(err).toMatchObject({ code: 'VALIDATION' });
        expect(snapshot(env)).toBe(before);
        expectIntegrity(env.d);
      }
    });
  }

  it('las fechas de anio 4 digitos >= 0100 no se rechazan por el anio (se aceptan en los bordes simples)', () => {
    const env = setup();
    for (const date of ['0100-01-01', '1999-12-31', '2026-02-28']) {
      expect(() => env.d.goals.create({ name: `G${date}`, targetMinor: 100, targetDate: date })).not.toThrow();
    }
  });
});

describe("'0100-01-01' se acepta y hace ida y vuelta", () => {
  it('meta: targetDate se guarda como medianoche local de 0100 y vuelve igual', () => {
    const { d } = setup();
    const id = d.goals.create({ name: 'G', targetMinor: 100, targetDate: '0100-01-01' }).result.id;
    const stored = d.goals.get(id)?.targetDate;
    expect(stored).toBe(localDateToEpochMs('0100-01-01'));
    expect(toLocalDate(stored as number)).toBe('0100-01-01');
    // Vencida: el ETA lo refleja sin romperse.
    expect(d.goals.get(id)?.eta).toMatchObject({ kind: 'BY_TARGET_DATE', date: '0100-01-01', overdue: true });
  });

  it('recurrente: ancla y proxima fecha quedan en 0100-01-01', () => {
    const { d } = setup();
    const id = d.recurring.create({ type: 'EXPENSE', name: 'R', amountMinor: 1, frequency: 'MONTHLY', anchorDate: '0100-01-01' }).result.id;
    expect(d.recurring.list().find((r) => r.id === id)).toMatchObject({ anchorDate: '0100-01-01', nextDueDate: '0100-01-01' });
  });

  it('deuda: nextDueDate 0100-01-01 se conserva', () => {
    const { d } = setup();
    const id = d.debts.create({ name: 'D', balanceMinor: 100, installmentMinor: 10, rate: { known: 0 }, nextDueDate: '0100-01-01' }).result.id;
    expect(d.debts.get(id)?.nextDueDate).toBe('0100-01-01');
  });
});
