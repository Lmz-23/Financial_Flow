// Propiedad ESTRUCTURAL en los repositorios: cada metodo por id filtra por `userId` EN LA CONSULTA.
// Estos tests llaman a los repositorios DIRECTAMENTE (sin servicios, que ya comprueban propiedad):
// con el userId de B y ids de A no se devuelve ni se modifica nada (foto completa de las 9 tablas),
// y con el userId de A (control positivo) el mismo metodo SI actua (el test no es vacuo).
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_ID } from '../../../src/database/seed';
import { accountRepository } from '../../../src/database/repositories/accountRepository';
import {
  adjustmentRepository,
  type AdjustmentTarget,
} from '../../../src/database/repositories/adjustmentRepository';
import { categoryRepository } from '../../../src/database/repositories/categoryRepository';
import { debtRepository } from '../../../src/database/repositories/debtRepository';
import { goalContributionRepository } from '../../../src/database/repositories/goalContributionRepository';
import { goalRepository } from '../../../src/database/repositories/goalRepository';
import { recurringRepository } from '../../../src/database/repositories/recurringRepository';
import { transactionRepository } from '../../../src/database/repositories/transactionRepository';
import { mkAccount, secondUserDomain, setup, snapshot, type TestEnv } from '../domain/_helpers';

const USER_A = DEFAULT_USER_ID;
const USER_B = 'otro-usuario';

interface World {
  env: TestEnv;
  now: number;
  /** Cuenta con ajuste de apertura, gasto, ingreso y aporte a meta. */
  accMov: string;
  /** Cuenta sin movimientos ni ajustes (borrable). */
  accEmpty: string;
  /** Cuenta archivada (tenia un aporte). */
  accArch: string;
  txA: string;
  catA: string;
  /** Deuda con ajuste de apertura y un pago de cuota (con recurrente de cuota). */
  debtPaid: string;
  recDebt: string;
  /** Deuda sin pagos (borrable tras quitar su ajuste de apertura). */
  debtSpare: string;
  /** Meta con aporte y ajuste manual. */
  goalSaved: string;
  /** Meta sin aportes ni ajustes (borrable). */
  goalSpare: string;
  /** Recurrente STANDARD con cuenta predeterminada y una ocurrencia confirmada. */
  recA: string;
  occurrence: string;
  /** Recurrente sin ocurrencias (borrable). */
  recSpare: string;
}

function world(): World {
  const env = setup();
  const a = env.d;

  const accMov = mkAccount(a, 'Con movimientos', 1_000_000);
  const accEmpty = mkAccount(a, 'Vacia', 0);
  const accArch = mkAccount(a, 'Archivada', 50_000);
  const txA = a.transactions.create({
    type: 'EXPENSE', accountId: accMov, amountMinor: 100, newCategoryName: 'CatA',
  }).result.id;
  a.transactions.create({ type: 'INCOME', accountId: accMov, amountMinor: 700 });
  const catA = a.transactions.categories('EXPENSE').find((c) => c.userId !== null)!.id;

  const debt = a.debts.create({
    name: 'Deuda A', balanceMinor: 500_000, installmentMinor: 50_000, rate: { known: 0.02 }, nextDueDate: '2026-04-01',
  }).result;
  a.debts.registerPayment({ debtId: debt.id, accountId: accMov, amountMinor: 50_000, type: 'INSTALLMENT' });
  const debtSpare = a.debts.create({ name: 'Deuda libre', balanceMinor: 10_000, rate: { known: 0.01 } }).result.id;

  const goalSaved = a.goals.create({ name: 'Meta A', targetMinor: 100_000 }).result.id;
  a.goals.contribute({ goalId: goalSaved, accountId: accMov, amountMinor: 30_000 });
  a.goals.contribute({ goalId: goalSaved, accountId: accArch, amountMinor: 10_000 });
  a.goals.update(goalSaved, { savedMinor: 45_000 });
  a.accounts.remove(accArch); // tiene un aporte: se archiva
  const goalSpare = a.goals.create({ name: 'Meta libre', targetMinor: 9_000 }).result.id;

  const recA = a.recurring.create({
    type: 'EXPENSE', name: 'Renta A', amountMinor: 1_000, frequency: 'MONTHLY', anchorDate: '2026-03-15',
    categoryId: catA, defaultAccountId: accMov,
  }).result.id;
  a.recurring.confirmOccurrence({ recurringId: recA, occurrenceDate: '2026-03-15', accountId: accMov });
  const recSpare = a.recurring.create({
    type: 'EXPENSE', name: 'Libre', amountMinor: 500, frequency: 'MONTHLY', anchorDate: '2026-03-20',
  }).result.id;

  // Datos propios de B (para que las consultas de B no operen sobre un usuario vacio).
  const b = secondUserDomain(env, USER_B);
  mkAccount(b, 'Cuenta B', 5_000);

  return {
    env, now: env.clock.now, accMov, accEmpty, accArch, txA, catA,
    debtPaid: debt.id, recDebt: debt.recurringId!, debtSpare,
    goalSaved, goalSpare, recA, occurrence: '2026-03-15', recSpare,
  };
}

interface Case {
  /** repositorio.metodo [variante] */
  name: string;
  run: (w: World, userId: string) => unknown;
  /** Resultado esperado con el userId de B (y datos de A). */
  foreign: unknown;
  /** Resultado esperado con el userId de A (control positivo). */
  own: (r: unknown) => void;
  /** Preparacion previa del control positivo (p. ej. quitar dependencias antes de borrar). */
  prepOwn?: (w: World) => void;
}

const one = (r: unknown) => expect(r).toBe(1);
const positive = (r: unknown) => expect(r as number).toBeGreaterThan(0);
const defined = (r: unknown) => expect(r).toBeDefined();
const nonEmpty = (r: unknown) => expect((r as unknown[]).length).toBeGreaterThan(0);

const T = (type: 'ACCOUNT' | 'DEBT' | 'GOAL', id: string): AdjustmentTarget => ({ type, id });

const cases: Case[] = [
  // ---- accountRepository
  { name: 'account.getById', run: (w, u) => accountRepository.getById(w.env.db, u, w.accMov), foreign: undefined, own: defined },
  { name: 'account.getById (archivada)', run: (w, u) => accountRepository.getById(w.env.db, u, w.accArch), foreign: undefined, own: defined },
  { name: 'account.rename', run: (w, u) => accountRepository.rename(w.env.db, u, w.accEmpty, 'Hackeada', w.now + 5), foreign: 0, own: one },
  { name: 'account.archive', run: (w, u) => accountRepository.archive(w.env.db, u, w.accEmpty, w.now + 5), foreign: 0, own: one },
  { name: 'account.unarchive', run: (w, u) => accountRepository.unarchive(w.env.db, u, w.accArch, w.now + 5), foreign: 0, own: one },
  {
    name: 'account.delete', run: (w, u) => accountRepository.delete(w.env.db, u, w.accEmpty), foreign: 0, own: one,
  },
  { name: 'account.hasMovements', run: (w, u) => accountRepository.hasMovements(w.env.db, u, w.accMov), foreign: false, own: (r) => expect(r).toBe(true) },
  { name: 'account.hasMovements (solo aporte)', run: (w, u) => accountRepository.hasMovements(w.env.db, u, w.accArch), foreign: false, own: (r) => expect(r).toBe(true) },
  { name: 'account.availableOf', run: (w, u) => accountRepository.availableOf(w.env.db, u, w.accMov), foreign: 0, own: positive },
  // ---- adjustmentRepository
  ...(['ACCOUNT', 'DEBT', 'GOAL'] as const).flatMap((type): Case[] => {
    const id = (w: World) => ({ ACCOUNT: w.accMov, DEBT: w.debtPaid, GOAL: w.goalSaved })[type];
    return [
      { name: `adjustment.sumDelta ${type}`, run: (w, u) => adjustmentRepository.sumDelta(w.env.db, u, T(type, id(w))), foreign: 0, own: positive },
      { name: `adjustment.listFor ${type}`, run: (w, u) => adjustmentRepository.listFor(w.env.db, u, T(type, id(w))), foreign: [], own: nonEmpty },
      { name: `adjustment.countFor ${type}`, run: (w, u) => adjustmentRepository.countFor(w.env.db, u, T(type, id(w))), foreign: 0, own: positive },
      {
        name: `adjustment.countFor ${type} (reason)`,
        run: (w, u) => adjustmentRepository.countFor(w.env.db, u, T(type, id(w)), type === 'GOAL' ? 'MANUAL' : 'OPENING'),
        foreign: 0, own: positive,
      },
      { name: `adjustment.deleteFor ${type}`, run: (w, u) => adjustmentRepository.deleteFor(w.env.db, u, T(type, id(w))), foreign: 0, own: positive },
    ];
  }),
  // ---- debtRepository
  { name: 'debt.getById', run: (w, u) => debtRepository.getById(w.env.db, u, w.debtPaid), foreign: undefined, own: defined },
  { name: 'debt.update', run: (w, u) => debtRepository.update(w.env.db, u, w.debtPaid, { name: 'Hackeada', installmentMinor: 1, now: w.now + 5 }), foreign: 0, own: one },
  { name: 'debt.archive', run: (w, u) => debtRepository.archive(w.env.db, u, w.debtPaid, w.now + 5), foreign: 0, own: one },
  {
    name: 'debt.delete', run: (w, u) => debtRepository.delete(w.env.db, u, w.debtSpare), foreign: 0, own: one,
    prepOwn: (w) => { adjustmentRepository.deleteFor(w.env.db, USER_A, T('DEBT', w.debtSpare)); },
  },
  { name: 'debt.principalAppliedTotal', run: (w, u) => debtRepository.principalAppliedTotal(w.env.db, u, w.debtPaid), foreign: 0, own: positive },
  { name: 'debt.balanceOf', run: (w, u) => debtRepository.balanceOf(w.env.db, u, w.debtPaid), foreign: 0, own: positive },
  { name: 'debt.installmentPaymentCount', run: (w, u) => debtRepository.installmentPaymentCount(w.env.db, u, w.debtPaid), foreign: 0, own: positive },
  // ---- goalRepository
  { name: 'goal.getById', run: (w, u) => goalRepository.getById(w.env.db, u, w.goalSaved), foreign: undefined, own: defined },
  { name: 'goal.update', run: (w, u) => goalRepository.update(w.env.db, u, w.goalSaved, { name: 'Hackeada', targetMinor: 1, targetDate: null, now: w.now + 5 }), foreign: 0, own: one },
  { name: 'goal.markSpent', run: (w, u) => goalRepository.markSpent(w.env.db, u, w.goalSaved, 1, w.now + 5), foreign: 0, own: one },
  { name: 'goal.delete', run: (w, u) => goalRepository.delete(w.env.db, u, w.goalSpare), foreign: 0, own: one },
  { name: 'goal.savedOf', run: (w, u) => goalRepository.savedOf(w.env.db, u, w.goalSaved), foreign: 0, own: positive },
  // ---- goalContributionRepository
  { name: 'goalContribution.listByGoal', run: (w, u) => goalContributionRepository.listByGoal(w.env.db, u, w.goalSaved), foreign: [], own: nonEmpty },
  { name: 'goalContribution.totalsByAccount', run: (w, u) => goalContributionRepository.totalsByAccount(w.env.db, u, w.goalSaved), foreign: [], own: nonEmpty },
  { name: 'goalContribution.deleteByGoal', run: (w, u) => goalContributionRepository.deleteByGoal(w.env.db, u, w.goalSaved), foreign: 0, own: positive },
  // ---- recurringRepository
  { name: 'recurring.getById', run: (w, u) => recurringRepository.getById(w.env.db, u, w.recA), foreign: undefined, own: defined },
  { name: 'recurring.getByDebtId', run: (w, u) => recurringRepository.getByDebtId(w.env.db, u, w.debtPaid), foreign: undefined, own: defined },
  { name: 'recurring.update', run: (w, u) => recurringRepository.update(w.env.db, u, w.recA, { name: 'Hackeado', amountMinor: 1, snoozedUntil: w.now + 9, now: w.now + 5 }), foreign: 0, own: one },
  { name: 'recurring.delete', run: (w, u) => recurringRepository.delete(w.env.db, u, w.recSpare), foreign: 0, own: one },
  { name: 'recurring.clearDefaultAccount', run: (w, u) => recurringRepository.clearDefaultAccount(w.env.db, u, w.accMov, w.now + 5), foreign: 0, own: positive },
  // ---- transactionRepository
  { name: 'transaction.getById', run: (w, u) => transactionRepository.getById(w.env.db, u, w.txA), foreign: undefined, own: defined },
  { name: 'transaction.getViewById', run: (w, u) => transactionRepository.getViewById(w.env.db, u, w.txA), foreign: undefined, own: defined },
  { name: 'transaction.delete', run: (w, u) => transactionRepository.delete(w.env.db, u, w.txA), foreign: 0, own: one },
  { name: 'transaction.findByOccurrence', run: (w, u) => transactionRepository.findByOccurrence(w.env.db, u, w.recA, w.occurrence), foreign: undefined, own: defined },
  { name: 'transaction.confirmedOccurrences', run: (w, u) => transactionRepository.confirmedOccurrences(w.env.db, u, w.recA), foreign: [], own: nonEmpty },
  { name: 'transaction.countPaymentsOfDebt', run: (w, u) => transactionRepository.countPaymentsOfDebt(w.env.db, u, w.debtPaid), foreign: 0, own: positive },
  { name: 'transaction.listPaymentsOfDebt', run: (w, u) => transactionRepository.listPaymentsOfDebt(w.env.db, u, w.debtPaid), foreign: [], own: nonEmpty },
  { name: 'transaction.unlinkRecurring', run: (w, u) => transactionRepository.unlinkRecurring(w.env.db, u, w.recA), foreign: 0, own: positive },
  // ---- categoryRepository
  { name: 'category.getById (propia de A)', run: (w, u) => categoryRepository.getById(w.env.db, u, w.catA), foreign: undefined, own: defined },
];

describe('repositorios: un userId ajeno no devuelve ni modifica nada (por id)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    // Ajeno: B consulta/muta datos de A -> resultado vacio y foto de las 9 tablas intacta.
    const w = world();
    const before = snapshot(w.env);
    const foreign = c.run(w, USER_B);
    expect(foreign).toEqual(c.foreign);
    expect(snapshot(w.env)).toBe(before);

    // Control positivo: con el userId de A el mismo metodo actua (en un mundo nuevo).
    const w2 = world();
    c.prepOwn?.(w2);
    c.own(c.run(w2, USER_A));
  });
});

describe('repositorios: la cobertura de casos incluye cada metodo por id', () => {
  it('hay al menos un caso por metodo mutador/consultor por id', () => {
    const names = cases.map((c) => c.name.split(' ')[0]);
    for (const m of [
      'account.rename', 'account.archive', 'account.unarchive', 'account.delete', 'account.hasMovements',
      'account.availableOf', 'adjustment.sumDelta', 'adjustment.listFor', 'adjustment.deleteFor',
      'adjustment.countFor', 'debt.update', 'debt.archive', 'debt.delete', 'debt.principalAppliedTotal',
      'debt.balanceOf', 'debt.installmentPaymentCount', 'goal.update', 'goal.markSpent', 'goal.delete',
      'goal.savedOf', 'goalContribution.deleteByGoal', 'recurring.getByDebtId', 'recurring.update',
      'recurring.delete', 'recurring.clearDefaultAccount', 'transaction.delete',
      'transaction.confirmedOccurrences', 'transaction.countPaymentsOfDebt', 'transaction.unlinkRecurring',
    ]) {
      expect(names, m).toContain(m);
    }
  });
});

describe('limite documentado: la BD no distingue usuarios en las FK', () => {
  it('un INSERT con userId de B y accountId de A lo acepta la BD (FK simples); lo impide el SERVICIO', () => {
    // Esto es un limite, no un contrato deseable: las FK (accountId -> accounts.id) no incluyen el
    // userId, y los INSERT reciben el userId dentro de la fila. La unica defensa es el servicio
    // (requireActiveAccount/getById con NotFoundError, cubierto en test/integration/domain/ownership.test.ts).
    // Si algun dia el esquema usa FK compuestas (id, userId), este test debe cambiar a esperar un error.
    const w = world();
    expect(() =>
      goalContributionRepository.insert(w.env.db, {
        userId: USER_B, goalId: w.goalSaved, accountId: w.accMov, amountMinor: 1, date: w.now, now: w.now,
      }),
    ).not.toThrow();
  });
});
