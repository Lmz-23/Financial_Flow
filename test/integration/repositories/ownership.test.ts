// Propiedad ESTRUCTURAL en los repositorios: TODA funcion de TODO repositorio filtra por `userId` EN LA CONSULTA.
// Estos tests llaman a los repositorios DIRECTAMENTE (sin servicios, que ya comprueban propiedad):
// con el userId de B y un mundo con datos de A no se devuelve ni se modifica nada de A (foto completa de las
// 9 tablas idéntica; los resultados de B son los de B, nunca los de A), y con el userId de A (control
// positivo) el mismo metodo SI actua (el test no es vacuo).
//
// COBERTURA DINAMICA (ultimo bloque): la lista de funciones se deriva de `Object.keys` de cada repositorio
// CARGADO desde disco (src/database/repositories/*Repository.ts); una funcion nueva sin caso rompe el test.
// Complementa la guarda por AST (test/unit/repositoryOwnership.test.ts): la guarda prueba que el `where`
// REFERENCIA userId; estos tests prueban que la SEMANTICA es la correcta (columna y operador).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_ID } from '../../../src/database/seed';
import { accountRepository } from '../../../src/database/repositories/accountRepository';
import { accountTransferRepository } from '../../../src/database/repositories/accountTransferRepository';
import {
  adjustmentRepository,
  type AdjustmentTarget,
} from '../../../src/database/repositories/adjustmentRepository';
import { categoryRepository } from '../../../src/database/repositories/categoryRepository';
import { debtRepository } from '../../../src/database/repositories/debtRepository';
import { goalContributionRepository } from '../../../src/database/repositories/goalContributionRepository';
import { goalRepository } from '../../../src/database/repositories/goalRepository';
import { recurringRepository } from '../../../src/database/repositories/recurringRepository';
import { reportRepository } from '../../../src/database/repositories/reportRepository';
import { settingsRepository } from '../../../src/database/repositories/settingsRepository';
import { transactionRepository } from '../../../src/database/repositories/transactionRepository';
import { createDomain } from '../../../src/domain/createDomain';
import { mkAccount, secondUserDomain, setup, snapshot, type TestEnv } from '../domain/_helpers';

const USER_A = DEFAULT_USER_ID;
const USER_B = 'otro-usuario';
const GHOST = 'usuario-fantasma';

interface World {
  env: TestEnv;
  now: number;
  /** Cuenta con ajuste de apertura, gasto, ingreso y aportes a metas. */
  accMov: string;
  /** Cuenta sin movimientos ni ajustes (borrable). */
  accEmpty: string;
  /** Cuenta archivada (tenia un aporte). */
  accArch: string;
  /** Transferencia de A: accMov -> accArch (2.500, creada antes de archivar accArch). */
  xfer: string;
  /** Cuenta del usuario B (apertura 5.000). */
  accB: string;
  txA: string;
  catA: string;
  /** Deuda con ajuste de apertura y un pago de cuota (con recurrente de cuota). */
  debtPaid: string;
  recDebt: string;
  /** Deuda sin pagos (borrable tras quitar su ajuste de apertura). */
  debtSpare: string;
  /** Meta con 2 aportes y 2 ajustes manuales. */
  goalSaved: string;
  /** Meta sin aportes ni ajustes (borrable). */
  goalSpare: string;
  /** Meta CERRADA (SPENT) en marzo de 2026 con 20.000 gastados. */
  goalSpent: string;
  /** Recurrente STANDARD con cuenta predeterminada y 2 ocurrencias confirmadas. */
  recA: string;
  occurrence: string;
  /** Recurrente con la misma cuenta predeterminada que recA (clearDefaultAccount afecta a 2). */
  recC: string;
  /** Recurrente sin ocurrencias (borrable). */
  recSpare: string;
}

/** Instante de marzo de 2026 (zona del test) para los rangos de monthAggregates. */
const MARCH = { start: new Date(2026, 2, 1).getTime(), end: new Date(2026, 3, 1).getTime() };
const FAR = { start: 0, end: new Date(2100, 0, 1).getTime() };

function world(): World {
  const env = setup();
  const a = env.d;

  const accMov = mkAccount(a, 'Con movimientos', 1_000_000);
  const accEmpty = mkAccount(a, 'Vacia', 0);
  const accArch = mkAccount(a, 'Archivada', 50_000);
  const xfer = a.transfers.create({ fromAccountId: accMov, toAccountId: accArch, amountMinor: 2_500 }).result.id;
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
  a.goals.update(goalSaved, { savedMinor: 50_000 });
  a.accounts.remove(accArch); // tiene un aporte: se archiva
  const goalSpare = a.goals.create({ name: 'Meta libre', targetMinor: 9_000 }).result.id;
  const goalSpent = a.goals.create({ name: 'Meta gastada', targetMinor: 20_000 }).result.id;
  a.goals.contribute({ goalId: goalSpent, accountId: accMov, amountMinor: 20_000 });
  a.goals.close(goalSpent);

  const recA = a.recurring.create({
    type: 'EXPENSE', name: 'Renta A', amountMinor: 1_000, frequency: 'MONTHLY', anchorDate: '2026-02-15',
    categoryId: catA, defaultAccountId: accMov,
  }).result.id;
  a.recurring.confirmOccurrence({ recurringId: recA, occurrenceDate: '2026-02-15', accountId: accMov });
  a.recurring.confirmOccurrence({ recurringId: recA, occurrenceDate: '2026-03-15', accountId: accMov });
  const recC = a.recurring.create({
    type: 'EXPENSE', name: 'Renta C', amountMinor: 2_000, frequency: 'MONTHLY', anchorDate: '2026-03-18',
    defaultAccountId: accMov,
  }).result.id;
  const recSpare = a.recurring.create({
    type: 'EXPENSE', name: 'Libre', amountMinor: 500, frequency: 'MONTHLY', anchorDate: '2026-03-20',
  }).result.id;

  // Datos propios de B (para que las consultas de B no operen sobre un usuario vacio).
  const b = secondUserDomain(env, USER_B);
  const accB = mkAccount(b, 'Cuenta B', 5_000);

  return {
    env, now: env.clock.now, accMov, accEmpty, accArch, accB, xfer, txA, catA,
    debtPaid: debt.id, recDebt: debt.recurringId!, debtSpare,
    goalSaved, goalSpare, goalSpent, recA, occurrence: '2026-03-15', recC, recSpare,
  };
}

interface Case {
  /** repositorio.metodo [variante]; el primer token ("repo.metodo") alimenta la cobertura dinamica. */
  name: string;
  run: (w: World, userId: string) => unknown;
  /** Resultado esperado con el userId de B (y datos de A): el "vacio" o lo que B tiene de verdad. */
  foreign: unknown;
  /** Resultado esperado con el userId de A (control positivo). */
  own: (r: unknown, w: World) => void;
  /** Preparacion que se aplica a AMBOS mundos antes de la foto (p. ej. datos corruptos de A). */
  prep?: (w: World) => void;
  /** Preparacion previa solo del control positivo (p. ej. quitar dependencias antes de borrar). */
  prepOwn?: (w: World) => void;
  /** Usuario "ajeno" (por defecto B). */
  foreignUser?: string;
}

const exact = (n: number) => (r: unknown) => expect(r).toBe(n);
const one = exact(1);
const defined = (r: unknown) => expect(r).toBeDefined();
const nonEmpty = (r: unknown) => expect((r as unknown[]).length).toBeGreaterThan(0);
const positive = (r: unknown) => expect(r as number).toBeGreaterThan(0);
const has = (key: keyof World) => (r: unknown, w: World) => expect(r).toContain(w[key] as string);
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

const T = (type: 'ACCOUNT' | 'DEBT' | 'GOAL', id: string): AdjustmentTarget => ({ type, id });

function sqlOne<TOut>(w: World, query: string, ...params: unknown[]): TOut {
  return w.env.sqlite.prepare(query).pluck().get(...params) as TOut;
}

// ---- Datos corruptos de A construidos por SQL directo (los CHECK/UNIQUE de la BD impiden crearlos por la API).
// `PRAGMA ignore_check_constraints = ON` permite escribirlos y se vuelve a activar al terminar; el indice unico
// de ocurrencias se elimina solo para fabricar el duplicado. Se aplica a AMBOS mundos: el usuario B no debe ver
// ninguna de estas violaciones de A, y A si.
function corruptPaymentRange(w: World): void {
  const db = w.env.sqlite;
  db.pragma('ignore_check_constraints = ON');
  db.prepare(
    "update transactions set debt_principal_applied_minor = amount_minor + 1 where user_id = ? and kind = 'DEBT_PAYMENT'",
  ).run(USER_A);
  db.pragma('ignore_check_constraints = OFF');
}
function corruptDuplicatedOccurrence(w: World): void {
  const db = w.env.sqlite;
  const cols = (db.prepare('pragma table_info(transactions)').all() as { name: string }[]).map((c) => c.name);
  const select = cols.map((c) => (c === 'id' ? "'dup-' || id" : c)).join(', ');
  db.exec('drop index uq_tx_recurring_occurrence');
  db.prepare(
    `insert into transactions (${cols.join(', ')}) select ${select} from transactions where recurring_item_id = ? and occurrence_date = ?`,
  ).run(w.recA, w.occurrence);
}
function corruptGenericOnDebtRecurring(w: World): void {
  const db = w.env.sqlite;
  db.pragma('ignore_check_constraints = ON');
  db.prepare("update transactions set recurring_item_id = ?, occurrence_date = '2099-01-01' where id = ?").run(
    w.recDebt, w.txA,
  );
  db.pragma('ignore_check_constraints = OFF');
}
function corruptMisclassified(w: World): void {
  const db = w.env.sqlite;
  db.pragma('ignore_check_constraints = ON');
  db.prepare('update transactions set is_passive = 1 where id = ?').run(w.txA); // pasivo en un GASTO
  db.pragma('ignore_check_constraints = OFF');
}
function corruptWidget(w: World): void {
  const db = w.env.sqlite;
  db.pragma('ignore_check_constraints = ON');
  db.prepare('update users set widget_cashflow = 5 where id = ?').run(USER_A);
  db.pragma('ignore_check_constraints = OFF');
}

const ZERO_MONTH = { ingresoTotal: 0, ingresoPasivo: 0, gastoVida: 0, gastoDeuda: 0, gastoMetas: 0 };
const noMaps = new Map<string, number>();

const cases: Case[] = [
  // ---- accountRepository
  { name: 'account.getById', run: (w, u) => accountRepository.getById(w.env.db, u, w.accMov), foreign: undefined, own: defined },
  { name: 'account.getById (archivada)', run: (w, u) => accountRepository.getById(w.env.db, u, w.accArch), foreign: undefined, own: defined },
  { name: 'account.listActive', run: (w, u) => ids(accountRepository.listActive(w.env.db, u)), foreign: (w: World) => [w.accB], own: (r, w) => { expect(r).toContain(w.accMov); expect(r).not.toContain(w.accArch); } },
  { name: 'account.listAll', run: (w, u) => ids(accountRepository.listAll(w.env.db, u)), foreign: (w: World) => [w.accB], own: (r, w) => { expect(r).toContain(w.accMov); expect(r).toContain(w.accArch); } },
  // A tiene 3 cuentas (orden 0..2); B una (orden 0): si se filtrara mal B veria 2.
  { name: 'account.maxOrder', run: (w, u) => accountRepository.maxOrder(w.env.db, u), foreign: 0, own: exact(2) },
  { name: 'account.rename', run: (w, u) => accountRepository.rename(w.env.db, u, w.accEmpty, 'Hackeada', w.now + 5), foreign: 0, own: one },
  { name: 'account.archive', run: (w, u) => accountRepository.archive(w.env.db, u, w.accEmpty, w.now + 5), foreign: 0, own: one },
  { name: 'account.unarchive', run: (w, u) => accountRepository.unarchive(w.env.db, u, w.accArch, w.now + 5), foreign: 0, own: one },
  { name: 'account.delete', run: (w, u) => accountRepository.delete(w.env.db, u, w.accEmpty), foreign: 0, own: one },
  { name: 'account.hasMovements', run: (w, u) => accountRepository.hasMovements(w.env.db, u, w.accMov), foreign: false, own: (r) => expect(r).toBe(true) },
  { name: 'account.hasMovements (solo aporte)', run: (w, u) => accountRepository.hasMovements(w.env.db, u, w.accArch), foreign: false, own: (r) => expect(r).toBe(true) },
  { name: 'account.availableOf', run: (w, u) => accountRepository.availableOf(w.env.db, u, w.accMov), foreign: 0, own: positive },
  {
    name: 'account.availableByAccount',
    run: (w, u) => accountRepository.availableByAccount(w.env.db, u),
    foreign: (w: World) => new Map([[w.accB, 5_000]]),
    own: (r, w) => {
      const m = r as Map<string, number>;
      expect(m.has(w.accMov)).toBe(true);
      expect(m.has(w.accArch)).toBe(true);
      expect(m.has(w.accB)).toBe(false);
    },
  },
  // ---- accountTransferRepository
  { name: 'accountTransfer.getById', run: (w, u) => accountTransferRepository.getById(w.env.db, u, w.xfer), foreign: undefined, own: defined },
  { name: 'accountTransfer.getViewById', run: (w, u) => accountTransferRepository.getViewById(w.env.db, u, w.xfer), foreign: undefined, own: defined },
  { name: 'accountTransfer.list', run: (w, u) => ids(accountTransferRepository.list(w.env.db, u)), foreign: [], own: has('xfer') },
  { name: 'accountTransfer.list (filtros)', run: (w, u) => ids(accountTransferRepository.list(w.env.db, u, { accountId: w.accArch, from: 0, to: FAR.end, limit: 50 })), foreign: [], own: has('xfer') },
  { name: 'accountTransfer.update', run: (w, u) => accountTransferRepository.update(w.env.db, u, w.xfer, { fromAccountId: w.accMov, toAccountId: w.accEmpty, amountMinor: 1, date: w.now, note: 'Hackeada', now: w.now + 5 }), foreign: 0, own: one },
  { name: 'accountTransfer.delete', run: (w, u) => accountTransferRepository.delete(w.env.db, u, w.xfer), foreign: 0, own: one },
  // ---- adjustmentRepository
  ...(['ACCOUNT', 'DEBT', 'GOAL'] as const).flatMap((type): Case[] => {
    const id = (w: World) => ({ ACCOUNT: w.accMov, DEBT: w.debtPaid, GOAL: w.goalSaved })[type];
    // Ajustes del objetivo en el mundo: apertura (1) en cuenta y deuda; 2 manuales en la meta.
    const n = { ACCOUNT: 1, DEBT: 1, GOAL: 2 }[type];
    return [
      { name: `adjustment.sumDelta ${type}`, run: (w, u) => adjustmentRepository.sumDelta(w.env.db, u, T(type, id(w))), foreign: 0, own: positive },
      { name: `adjustment.listFor ${type}`, run: (w, u) => adjustmentRepository.listFor(w.env.db, u, T(type, id(w))), foreign: [], own: (r) => expect((r as unknown[]).length).toBe(n) },
      { name: `adjustment.countFor ${type}`, run: (w, u) => adjustmentRepository.countFor(w.env.db, u, T(type, id(w))), foreign: 0, own: exact(n) },
      {
        name: `adjustment.countFor ${type} (reason)`,
        run: (w, u) => adjustmentRepository.countFor(w.env.db, u, T(type, id(w)), type === 'GOAL' ? 'MANUAL' : 'OPENING'),
        foreign: 0, own: exact(n),
      },
      { name: `adjustment.deleteFor ${type}`, run: (w, u) => adjustmentRepository.deleteFor(w.env.db, u, T(type, id(w))), foreign: 0, own: exact(n) },
    ];
  }),
  // ---- categoryRepository (las del sistema, userId NULL, las ven todos: se filtra solo lo propio de A)
  { name: 'category.getById (propia de A)', run: (w, u) => categoryRepository.getById(w.env.db, u, w.catA), foreign: undefined, own: defined },
  { name: 'category.findByName', run: (w, u) => categoryRepository.findByName(w.env.db, u, 'EXPENSE', 'CatA')?.id, foreign: undefined, own: (r, w) => expect(r).toBe(w.catA) },
  {
    name: 'category.listActive',
    run: (w, u) => categoryRepository.listActive(w.env.db, u).filter((c) => c.userId !== null).map((c) => c.id),
    foreign: [], own: has('catA'),
  },
  {
    name: 'category.listActive (tipo)',
    run: (w, u) => categoryRepository.listActive(w.env.db, u, 'EXPENSE').filter((c) => c.userId !== null).map((c) => c.id),
    foreign: [], own: has('catA'),
  },
  {
    // El maximo de B es el de las categorias del sistema; la categoria propia de A (orden max+1) no lo altera.
    name: 'category.maxOrder',
    run: (w, u) => categoryRepository.maxOrder(w.env.db, u, 'EXPENSE'),
    foreign: (w: World) => sqlOne<number>(w, "select max(\"order\") from categories where type = 'EXPENSE' and user_id is null"),
    own: (r, w) => expect(r).toBe(sqlOne<number>(w, "select max(\"order\") from categories where type = 'EXPENSE'")),
  },
  // ---- debtRepository
  { name: 'debt.getById', run: (w, u) => debtRepository.getById(w.env.db, u, w.debtPaid), foreign: undefined, own: defined },
  { name: 'debt.list', run: (w, u) => ids(debtRepository.list(w.env.db, u)), foreign: [], own: has('debtPaid') },
  { name: 'debt.list (archivadas)', run: (w, u) => ids(debtRepository.list(w.env.db, u, true)), foreign: [], own: has('debtSpare') },
  { name: 'debt.update', run: (w, u) => debtRepository.update(w.env.db, u, w.debtPaid, { name: 'Hackeada', installmentMinor: 1, now: w.now + 5 }), foreign: 0, own: one },
  { name: 'debt.archive', run: (w, u) => debtRepository.archive(w.env.db, u, w.debtPaid, w.now + 5), foreign: 0, own: one },
  {
    name: 'debt.delete', run: (w, u) => debtRepository.delete(w.env.db, u, w.debtSpare), foreign: 0, own: one,
    prepOwn: (w) => { adjustmentRepository.deleteFor(w.env.db, USER_A, T('DEBT', w.debtSpare)); },
  },
  { name: 'debt.principalAppliedTotal', run: (w, u) => debtRepository.principalAppliedTotal(w.env.db, u, w.debtPaid), foreign: 0, own: positive },
  { name: 'debt.balanceOf', run: (w, u) => debtRepository.balanceOf(w.env.db, u, w.debtPaid), foreign: 0, own: positive },
  { name: 'debt.installmentPaymentCount', run: (w, u) => debtRepository.installmentPaymentCount(w.env.db, u, w.debtPaid), foreign: 0, own: one },
  {
    name: 'debt.balancesByDebt', run: (w, u) => debtRepository.balancesByDebt(w.env.db, u), foreign: noMaps,
    own: (r, w) => { const m = r as Map<string, number>; expect(m.size).toBe(2); expect(m.get(w.debtPaid)).toBeGreaterThan(0); },
  },
  {
    name: 'debt.installmentCountsByDebt', run: (w, u) => debtRepository.installmentCountsByDebt(w.env.db, u), foreign: noMaps,
    own: (r, w) => expect(r).toEqual(new Map([[w.debtPaid, 1]])),
  },
  // ---- goalRepository
  { name: 'goal.getById', run: (w, u) => goalRepository.getById(w.env.db, u, w.goalSaved), foreign: undefined, own: defined },
  { name: 'goal.list', run: (w, u) => ids(goalRepository.list(w.env.db, u)), foreign: [], own: has('goalSaved') },
  { name: 'goal.list (estado)', run: (w, u) => ids(goalRepository.list(w.env.db, u, 'SPENT')), foreign: [], own: (r, w) => expect(r).toEqual([w.goalSpent]) },
  { name: 'goal.update', run: (w, u) => goalRepository.update(w.env.db, u, w.goalSaved, { name: 'Hackeada', targetMinor: 1, targetDate: null, now: w.now + 5 }), foreign: 0, own: one },
  { name: 'goal.markSpent', run: (w, u) => goalRepository.markSpent(w.env.db, u, w.goalSaved, 1, w.now + 5), foreign: 0, own: one },
  { name: 'goal.delete', run: (w, u) => goalRepository.delete(w.env.db, u, w.goalSpare), foreign: 0, own: one },
  { name: 'goal.savedOf', run: (w, u) => goalRepository.savedOf(w.env.db, u, w.goalSaved), foreign: 0, own: exact(50_000) },
  {
    name: 'goal.savedByGoal', run: (w, u) => goalRepository.savedByGoal(w.env.db, u), foreign: noMaps,
    own: (r, w) => { const m = r as Map<string, number>; expect(m.get(w.goalSaved)).toBe(50_000); expect(m.get(w.goalSpent)).toBe(20_000); },
  },
  // ---- goalContributionRepository
  { name: 'goalContribution.listByGoal', run: (w, u) => goalContributionRepository.listByGoal(w.env.db, u, w.goalSaved), foreign: [], own: nonEmpty },
  { name: 'goalContribution.totalsByAccount', run: (w, u) => goalContributionRepository.totalsByAccount(w.env.db, u, w.goalSaved), foreign: [], own: nonEmpty },
  { name: 'goalContribution.deleteByGoal', run: (w, u) => goalContributionRepository.deleteByGoal(w.env.db, u, w.goalSaved), foreign: 0, own: exact(2) },
  // ---- recurringRepository
  { name: 'recurring.getById', run: (w, u) => recurringRepository.getById(w.env.db, u, w.recA), foreign: undefined, own: defined },
  { name: 'recurring.getByDebtId', run: (w, u) => recurringRepository.getByDebtId(w.env.db, u, w.debtPaid), foreign: undefined, own: defined },
  { name: 'recurring.listStandard', run: (w, u) => ids(recurringRepository.listStandard(w.env.db, u)), foreign: [], own: has('recA') },
  { name: 'recurring.listActiveDated', run: (w, u) => ids(recurringRepository.listActiveDated(w.env.db, u)), foreign: [], own: has('recA') },
  { name: 'recurring.update', run: (w, u) => recurringRepository.update(w.env.db, u, w.recA, { name: 'Hackeado', amountMinor: 1, snoozedUntil: w.now + 9, now: w.now + 5 }), foreign: 0, own: one },
  { name: 'recurring.delete', run: (w, u) => recurringRepository.delete(w.env.db, u, w.recSpare), foreign: 0, own: one },
  { name: 'recurring.clearDefaultAccount', run: (w, u) => recurringRepository.clearDefaultAccount(w.env.db, u, w.accMov, w.now + 5), foreign: 0, own: exact(2) },
  // ---- transactionRepository
  { name: 'transaction.getById', run: (w, u) => transactionRepository.getById(w.env.db, u, w.txA), foreign: undefined, own: defined },
  { name: 'transaction.getViewById', run: (w, u) => transactionRepository.getViewById(w.env.db, u, w.txA), foreign: undefined, own: defined },
  { name: 'transaction.list', run: (w, u) => ids(transactionRepository.list(w.env.db, u)), foreign: [], own: has('txA') },
  { name: 'transaction.list (filtros)', run: (w, u) => ids(transactionRepository.list(w.env.db, u, { accountId: w.accMov, type: 'EXPENSE', from: 0, to: FAR.end, limit: 50 })), foreign: [], own: has('txA') },
  { name: 'transaction.update', run: (w, u) => transactionRepository.update(w.env.db, u, w.txA, { accountId: w.accMov, amountMinor: 1, description: 'Hackeada', date: w.now, categoryId: null, isPassive: false, now: w.now + 5 }), foreign: 0, own: one },
  { name: 'transaction.delete', run: (w, u) => transactionRepository.delete(w.env.db, u, w.txA), foreign: 0, own: one },
  { name: 'transaction.findByOccurrence', run: (w, u) => transactionRepository.findByOccurrence(w.env.db, u, w.recA, w.occurrence), foreign: undefined, own: defined },
  { name: 'transaction.confirmedOccurrences', run: (w, u) => transactionRepository.confirmedOccurrences(w.env.db, u, w.recA), foreign: [], own: (r) => expect((r as string[]).slice().sort()).toEqual(['2026-02-15', '2026-03-15']) },
  { name: 'transaction.countPaymentsOfDebt', run: (w, u) => transactionRepository.countPaymentsOfDebt(w.env.db, u, w.debtPaid), foreign: 0, own: one },
  { name: 'transaction.listPaymentsOfDebt', run: (w, u) => transactionRepository.listPaymentsOfDebt(w.env.db, u, w.debtPaid), foreign: [], own: (r) => expect((r as unknown[]).length).toBe(1) },
  { name: 'transaction.unlinkRecurring', run: (w, u) => transactionRepository.unlinkRecurring(w.env.db, u, w.recA), foreign: 0, own: exact(2) },
  // ---- reportRepository (8): B tiene SU cuenta con 5.000 de apertura, nada mas
  {
    name: 'report.monthAggregates (marzo)', run: (w, u) => reportRepository.monthAggregates(w.env.db, u, MARCH.start, MARCH.end),
    foreign: ZERO_MONTH,
    own: (r) => expect(r).toMatchObject({ ingresoTotal: 700, gastoMetas: 20_000 }),
  },
  {
    name: 'report.monthAggregates (todo el tiempo)', run: (w, u) => reportRepository.monthAggregates(w.env.db, u, FAR.start, FAR.end),
    foreign: ZERO_MONTH,
    own: (r) => expect((r as { gastoVida: number }).gastoVida).toBeGreaterThan(0),
  },
  { name: 'report.ledgerTotal', run: (w, u) => reportRepository.ledgerTotal(w.env.db, u), foreign: 5_000, own: (r) => { expect(r).not.toBe(5_000); expect(r as number).toBeGreaterThan(5_000); } },
  { name: 'report.spentGoalsTotal', run: (w, u) => reportRepository.spentGoalsTotal(w.env.db, u), foreign: 0, own: exact(20_000) },
  {
    name: 'report.paymentsOutOfRange', run: (w, u) => reportRepository.paymentsOutOfRange(w.env.db, u).map((r) => r.id),
    foreign: [], prep: corruptPaymentRange, own: (r) => expect((r as string[]).length).toBe(1),
  },
  {
    name: 'report.duplicatedOccurrences', run: (w, u) => reportRepository.duplicatedOccurrences(w.env.db, u),
    foreign: [], prep: corruptDuplicatedOccurrence,
    own: (r, w) => expect(r).toEqual([{ recurringItemId: w.recA, occurrenceDate: w.occurrence, n: 2 }]),
  },
  {
    name: 'report.genericTxOnDebtRecurring', run: (w, u) => reportRepository.genericTxOnDebtRecurring(w.env.db, u),
    foreign: [], prep: corruptGenericOnDebtRecurring, own: (r, w) => expect(r).toEqual([w.txA]),
  },
  {
    name: 'report.misclassifiedTransactions', run: (w, u) => reportRepository.misclassifiedTransactions(w.env.db, u),
    foreign: [], prep: corruptMisclassified, own: (r, w) => expect(r).toEqual([w.txA]),
  },
  {
    name: 'report.invalidWidgetFlags', run: (w, u) => reportRepository.invalidWidgetFlags(w.env.db, u),
    foreign: [], prep: corruptWidget, own: (r) => expect(r).toEqual(['cashflow']),
  },
  // ---- settingsRepository: lectura (los 5 mutadores void tienen su propio bloque mas abajo)
  { name: 'settings.get', run: (w, u) => settingsRepository.get(w.env.db, u)?.id, foreign: USER_B, own: (r) => expect(r).toBe(USER_A) },
  { name: 'settings.get (usuario inexistente)', run: (w, u) => settingsRepository.get(w.env.db, u), foreign: undefined, foreignUser: GHOST, own: defined },
  {
    // A tiene el flag de deudas a 1; B nunca decidio (null): si se filtrara mal B leeria el de A.
    name: 'settings.getWidget', run: (w, u) => settingsRepository.getWidget(w.env.db, u, 'debts'), foreign: null,
    prep: (w) => w.env.sqlite.prepare("update users set widget_debts = 1 where id = ?").run(USER_A),
    own: (r) => expect(r).toBe(1),
  },
  { name: 'settings.getWidget (usuario inexistente)', run: (w, u) => settingsRepository.getWidget(w.env.db, u, 'debts'), foreign: null, foreignUser: GHOST, prep: (w) => w.env.sqlite.prepare("update users set widget_debts = 1 where id = ?").run(USER_A), own: (r) => expect(r).toBe(1) },
];

/** Tablas con dueno (`user_id`): las 8 de 0001_owner_triggers.sql y account_transfers (0002). */
const OWNED_TABLES = [
  'accounts', 'categories', 'debts', 'goals', 'recurring_items', 'transactions', 'goal_contributions',
  'account_transfers', 'balance_adjustments',
] as const;

/** `tabla:id` -> user_id de cada fila de las tablas con dueno. */
function owners(w: World): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const t of OWNED_TABLES) {
    for (const r of w.env.sqlite.prepare(`select id, user_id from ${t}`).all() as { id: string; user_id: string | null }[]) {
      out.set(`${t}:${r.id}`, r.user_id);
    }
  }
  return out;
}

function expectSameOwners(before: Map<string, string | null>, after: Map<string, string | null>): void {
  const changed = [...after].filter(([k, u]) => before.has(k) && before.get(k) !== u).map(([k]) => k);
  expect(changed, `filas que cambiaron de dueno: ${changed.join(', ')}`).toEqual([]);
  expect(before.size, 'el mundo tiene filas con dueno').toBeGreaterThan(0);
}

function expectedForeign(c: Case, w: World): unknown {
  return typeof c.foreign === 'function' ? (c.foreign as (w: World) => unknown)(w) : c.foreign;
}

describe('repositorios: un userId ajeno no devuelve ni modifica nada (cada funcion, cada repositorio)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    // Ajeno: otro usuario consulta/muta con datos de A presentes -> lo suyo (vacio o sus propios datos)
    // y foto de las 9 tablas intacta.
    const w = world();
    c.prep?.(w);
    const before = snapshot(w.env);
    const foreign = c.run(w, c.foreignUser ?? USER_B);
    expect(foreign).toEqual(expectedForeign(c, w));
    expect(snapshot(w.env)).toBe(before);

    // Control positivo: con el userId de A el mismo metodo actua (en un mundo nuevo).
    const w2 = world();
    c.prep?.(w2);
    c.prepOwn?.(w2);
    const ownersBefore = owners(w2);
    c.own(c.run(w2, USER_A), w2);
    // Estado final: ninguna fila que sobrevive cambio de dueno (con B existente como destino posible).
    expectSameOwners(ownersBefore, owners(w2));
  });
});

describe('repositorios: los valores del mundo (los conteos exactos de los casos no dependen de los repositorios)', () => {
  it('conteos de filas por SQL directo', () => {
    const w = world();
    expect(sqlOne(w, "select count(*) from balance_adjustments where user_id = ? and account_id = ?", USER_A, w.accMov)).toBe(1);
    expect(sqlOne(w, "select count(*) from balance_adjustments where user_id = ? and debt_id = ?", USER_A, w.debtPaid)).toBe(1);
    expect(sqlOne(w, "select count(*) from balance_adjustments where user_id = ? and goal_id = ? and reason = 'MANUAL'", USER_A, w.goalSaved)).toBe(2);
    expect(sqlOne(w, "select count(*) from balance_adjustments where goal_id = ?", w.goalSaved)).toBe(2);
    expect(sqlOne(w, 'select count(*) from goal_contributions where goal_id = ?', w.goalSaved)).toBe(2);
    expect(sqlOne(w, 'select count(*) from recurring_items where default_account_id = ?', w.accMov)).toBe(2);
    expect(sqlOne(w, 'select count(*) from transactions where recurring_item_id = ?', w.recA)).toBe(2);
    expect(sqlOne(w, "select count(*) from transactions where debt_id = ? and debt_payment_type = 'INSTALLMENT'", w.debtPaid)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// settingsRepository: mutadores `void`. No reciben ids: el "ajeno" es operar con otro userId.
// ---------------------------------------------------------------------------------------------

const userRow = (w: World, id: string) => JSON.stringify(w.env.sqlite.prepare('select * from users where id = ?').get(id));

/** Foto de las 9 tablas SIN la fila del usuario indicado (para comprobar que el resto no cambia). */
function snapshotExceptUser(w: World, userId: string): string {
  const tables = [
    'users', 'accounts', 'categories', 'debts', 'goals', 'recurring_items',
    'transactions', 'goal_contributions', 'account_transfers', 'balance_adjustments',
  ];
  return JSON.stringify(
    tables.map((t) => [
      t,
      t === 'users'
        ? w.env.sqlite.prepare('select * from users where id <> ? order by rowid').all(userId)
        : w.env.sqlite.prepare(`select * from ${t} order by rowid`).all(),
    ]),
  );
}

interface SettingsMutator {
  name: string;
  run: (w: World, userId: string) => void;
}

const SETTINGS_MUTATORS: SettingsMutator[] = [
  { name: 'settings.setTheme', run: (w, u) => settingsRepository.setTheme(w.env.db, u, 'dark', w.now + 5) },
  {
    name: 'settings.setNotifications',
    run: (w, u) => settingsRepository.setNotifications(w.env.db, u, { notifyPaymentReminders: false, reminderHour: 4 }, w.now + 5),
  },
  { name: 'settings.setWidget', run: (w, u) => settingsRepository.setWidget(w.env.db, u, 'goals', false, w.now + 5) },
  { name: 'settings.autoActivateWidget', run: (w, u) => settingsRepository.autoActivateWidget(w.env.db, u, 'cashflow', w.now + 5) },
  { name: 'settings.markOnboardingCompleted', run: (w, u) => settingsRepository.markOnboardingCompleted(w.env.db, u, w.now + 5) },
];

describe('settingsRepository: los mutadores solo tocan la fila del userId recibido', () => {
  const prepared = (): World => {
    const w = world();
    // Flags sin decidir en A y en B: el autoActivate tiene algo que activar y el setWidget algo que cambiar.
    w.env.sqlite.prepare('update users set widget_cashflow = null, widget_goals = null').run();
    w.env.sqlite.prepare('update users set onboarding_completed_at = null').run();
    return w;
  };

  it.each(SETTINGS_MUTATORS.map((m) => [m.name, m] as const))('%s: usuario inexistente -> nada cambia', (_n, m) => {
    const w = prepared();
    const before = snapshot(w.env);
    m.run(w, GHOST);
    expect(snapshot(w.env)).toBe(before);
  });

  it.each(SETTINGS_MUTATORS.map((m) => [m.name, m] as const))('%s: operar como B no toca la fila de A ni nada mas', (_n, m) => {
    const w = prepared();
    const rowA = userRow(w, USER_A);
    const rowB = userRow(w, USER_B);
    const rest = snapshotExceptUser(w, USER_B);
    m.run(w, USER_B);
    expect(userRow(w, USER_A)).toBe(rowA);
    expect(snapshotExceptUser(w, USER_B)).toBe(rest);
    expect(userRow(w, USER_B)).not.toBe(rowB); // control: la llamada si actuo, sobre B
  });

  it.each(SETTINGS_MUTATORS.map((m) => [m.name, m] as const))('%s: control positivo con A (cambia la fila de A, no la de B)', (_n, m) => {
    const w = prepared();
    const rowA = userRow(w, USER_A);
    const rowB = userRow(w, USER_B);
    m.run(w, USER_A);
    expect(userRow(w, USER_A)).not.toBe(rowA);
    expect(userRow(w, USER_B)).toBe(rowB);
  });
});

// ---------------------------------------------------------------------------------------------
// reportRepository.monthAggregates: las metas SPENT de A no cuentan en el agregado de B.
// ---------------------------------------------------------------------------------------------

describe('reportRepository.monthAggregates: la suma de metas gastadas es por usuario', () => {
  it('con una meta SPENT de A en el mes, B ve 0; con otra de B, cada uno ve la suya', () => {
    const w = world();
    const b = secondUserDomainOf(w);
    expect(reportRepository.monthAggregates(w.env.db, USER_A, MARCH.start, MARCH.end).gastoMetas).toBe(20_000);
    // B sin metas gastadas: 0 aunque A tenga 20.000 en el mismo mes.
    expect(reportRepository.monthAggregates(w.env.db, USER_B, MARCH.start, MARCH.end)).toEqual(ZERO_MONTH);
    // B cierra su propia meta (3.000): cada usuario suma solo la suya.
    const g = b.goals.create({ name: 'Meta B', targetMinor: 3_000 }).result.id;
    b.goals.contribute({ goalId: g, accountId: w.accB, amountMinor: 3_000 });
    b.goals.close(g);
    expect(reportRepository.monthAggregates(w.env.db, USER_B, MARCH.start, MARCH.end).gastoMetas).toBe(3_000);
    expect(reportRepository.monthAggregates(w.env.db, USER_A, MARCH.start, MARCH.end).gastoMetas).toBe(20_000);
    expect(reportRepository.spentGoalsTotal(w.env.db, USER_B)).toBe(3_000);
    expect(reportRepository.spentGoalsTotal(w.env.db, USER_A)).toBe(20_000);
  });
});

function secondUserDomainOf(w: World) {
  // El usuario B ya existe en el mundo (world() lo crea): se reutiliza su dominio sin volver a insertar la fila.
  return createDomain(w.env.db, { userId: USER_B, now: () => w.env.clock.now });
}

// ---------------------------------------------------------------------------------------------
// Mutadores: conteo EXACTO de filas afectadas (N, 1 y 0), no `> 0`.
// ---------------------------------------------------------------------------------------------

describe('repositorios: los mutadores devuelven el numero EXACTO de filas afectadas', () => {
  it('N > 1: unlinkRecurring, clearDefaultAccount, deleteByGoal y deleteFor', () => {
    const w = world();
    const { db } = w.env;
    expect(transactionRepository.unlinkRecurring(db, USER_A, w.recA)).toBe(2);
    expect(sqlOne(w, 'select count(*) from transactions where recurring_item_id = ?', w.recA)).toBe(0);
    expect(recurringRepository.clearDefaultAccount(db, USER_A, w.accMov, w.now + 5)).toBe(2);
    expect(sqlOne(w, 'select count(*) from recurring_items where default_account_id = ?', w.accMov)).toBe(0);
    expect(goalContributionRepository.deleteByGoal(db, USER_A, w.goalSaved)).toBe(2);
    expect(adjustmentRepository.deleteFor(db, USER_A, T('GOAL', w.goalSaved))).toBe(2);
  });

  it('0 otra vez: repetir el mutador sobre lo ya borrado/desvinculado devuelve 0', () => {
    const w = world();
    const { db } = w.env;
    expect(transactionRepository.unlinkRecurring(db, USER_A, w.recA)).toBe(2);
    expect(transactionRepository.unlinkRecurring(db, USER_A, w.recA)).toBe(0);
    expect(goalContributionRepository.deleteByGoal(db, USER_A, w.goalSaved)).toBe(2);
    expect(goalContributionRepository.deleteByGoal(db, USER_A, w.goalSaved)).toBe(0);
    expect(accountRepository.delete(db, USER_A, w.accEmpty)).toBe(1);
    expect(accountRepository.delete(db, USER_A, w.accEmpty)).toBe(0);
    expect(transactionRepository.delete(db, USER_A, w.txA)).toBe(1);
    expect(transactionRepository.delete(db, USER_A, w.txA)).toBe(0);
  });

  it('0 con un id inexistente del propio usuario (todos los mutadores por id)', () => {
    const w = world();
    const { db } = w.env;
    const none = 'no-existe';
    expect(accountRepository.rename(db, USER_A, none, 'x', w.now)).toBe(0);
    expect(accountRepository.archive(db, USER_A, none, w.now)).toBe(0);
    expect(accountRepository.unarchive(db, USER_A, none, w.now)).toBe(0);
    expect(accountRepository.delete(db, USER_A, none)).toBe(0);
    expect(adjustmentRepository.deleteFor(db, USER_A, T('GOAL', none))).toBe(0);
    expect(debtRepository.update(db, USER_A, none, { name: 'x', now: w.now })).toBe(0);
    expect(debtRepository.archive(db, USER_A, none, w.now)).toBe(0);
    expect(debtRepository.delete(db, USER_A, none)).toBe(0);
    expect(goalRepository.update(db, USER_A, none, { name: 'x', now: w.now })).toBe(0);
    expect(goalRepository.markSpent(db, USER_A, none, 1, w.now)).toBe(0);
    expect(goalRepository.delete(db, USER_A, none)).toBe(0);
    expect(goalContributionRepository.deleteByGoal(db, USER_A, none)).toBe(0);
    expect(recurringRepository.update(db, USER_A, none, { name: 'x', now: w.now })).toBe(0);
    expect(recurringRepository.delete(db, USER_A, none)).toBe(0);
    expect(recurringRepository.clearDefaultAccount(db, USER_A, none, w.now)).toBe(0);
    expect(transactionRepository.delete(db, USER_A, none)).toBe(0);
    expect(transactionRepository.unlinkRecurring(db, USER_A, none)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Lo que la BD impone por trigger, y las categorias del sistema.
// ---------------------------------------------------------------------------------------------

describe('categorias: las del sistema las ve cualquier usuario, las propias solo su dueno', () => {
  it('B ve las del sistema (userId NULL) y no la propia de A', () => {
    const w = world();
    const system = categoryRepository.listActive(w.env.db, USER_B).filter((c) => c.userId === null);
    expect(system.length).toBeGreaterThan(0);
    const firstName = system[0].name;
    expect(categoryRepository.findByName(w.env.db, USER_B, system[0].type, firstName)?.userId).toBeNull();
    expect(categoryRepository.getById(w.env.db, USER_B, system[0].id)).toBeDefined();
    expect(categoryRepository.getById(w.env.db, USER_B, w.catA)).toBeUndefined();
  });
});

describe('la BD distingue usuarios en las referencias (triggers de 0001_owner_triggers.sql)', () => {
  it('un INSERT con userId de B y accountId/goalId de A lo rechaza la BD (OWNER_MISMATCH), ademas del SERVICIO', () => {
    // Antes era un limite documentado (FK simples sin userId). Ahora los triggers lo impiden; la primera
    // defensa sigue siendo el servicio (NotFoundError, test/integration/domain/ownership.test.ts).
    const w = world();
    const before = snapshot(w.env);
    expect(() =>
      goalContributionRepository.insert(w.env.db, {
        userId: USER_B, goalId: w.goalSaved, accountId: w.accMov, amountMinor: 1, date: w.now, now: w.now,
      }),
    ).toThrow(/OWNER_MISMATCH: goal_contributions\.goal_id/);
    expect(snapshot(w.env)).toBe(before);
  });

  it('un update que reasigne userId a un usuario EXISTENTE lo rechaza la BD (OWNER_IMMUTABLE)', () => {
    const w = world();
    const before = snapshot(w.env);
    expect(() =>
      w.env.sqlite.prepare('update accounts set user_id = ? where id = ?').run(USER_B, w.accMov),
    ).toThrow(/OWNER_IMMUTABLE: accounts\.user_id/);
    expect(snapshot(w.env)).toBe(before);
  });
});

// ---------------------------------------------------------------------------------------------
// COBERTURA DINAMICA: la lista de funciones sale de los repositorios CARGADOS desde disco.
// ---------------------------------------------------------------------------------------------

/**
 * Excepciones: funciones SIN caso de "usuario ajeno" en este archivo, con su justificacion. Mantener MINIMA.
 * `insert(db, v)` no recibe ids ni lee: el userId viaja DENTRO de la fila `v`. Su unica defensa es estructural:
 * la guarda por AST (regla R6: `userId: v.userId` en `.values`) y la de servicios (S1: `userId: ctx.userId`),
 * ademas de los triggers de la BD (bloque de arriba). Cada repositorio con `insert` figura aqui de forma explicita.
 */
const COVERAGE_EXCEPTIONS: Record<string, string> = Object.fromEntries(
  ['account', 'accountTransfer', 'adjustment', 'category', 'debt', 'goal', 'goalContribution', 'recurring', 'transaction'].map((r) => [
    `${r}.insert`,
    'insert(db, v): el userId va dentro de la fila; cubierto por la guarda AST (R6/S1), no por un caso de lectura/mutacion por id',
  ]),
);

const COVERED = new Set<string>([
  ...cases.map((c) => c.name.split(' ')[0]),
  ...SETTINGS_MUTATORS.map((m) => m.name),
]);

describe('cobertura dinamica: cada funcion exportada de cada repositorio tiene un caso', () => {
  const REPO_DIR = path.resolve(__dirname, '../../../src/database/repositories');
  const files = fs.readdirSync(REPO_DIR).filter((f) => /Repository\.ts$/.test(f)).sort();

  it('descubre los repositorios en disco', () => {
    expect(files.length).toBeGreaterThanOrEqual(11);
  });

  it('toda funcion exportada tiene un caso (o una excepcion justificada) y no hay casos huerfanos', async () => {
    const discovered: string[] = [];
    for (const f of files) {
      const mod = (await import(path.join(REPO_DIR, f))) as Record<string, Record<string, unknown>>;
      const repoName = f.replace(/\.ts$/, '');
      const short = repoName.replace(/Repository$/, '');
      for (const fn of Object.keys(mod[repoName])) discovered.push(`${short}.${fn}`);
    }
    const uncovered = discovered.filter((n) => !COVERED.has(n) && !(n in COVERAGE_EXCEPTIONS));
    expect(uncovered, `Funciones de repositorio SIN caso de userId ajeno:\n  ${uncovered.join('\n  ')}`).toEqual([]);
    const orphans = [...COVERED].filter((n) => !discovered.includes(n));
    expect(orphans, `Casos que nombran funciones que ya no existen:\n  ${orphans.join('\n  ')}`).toEqual([]);
    const staleExceptions = Object.keys(COVERAGE_EXCEPTIONS).filter((n) => !discovered.includes(n));
    expect(staleExceptions, `Excepciones de funciones inexistentes:\n  ${staleExceptions.join('\n  ')}`).toEqual([]);
    const needlessExceptions = Object.keys(COVERAGE_EXCEPTIONS).filter((n) => COVERED.has(n));
    expect(needlessExceptions, 'una excepcion que ya tiene caso sobra').toEqual([]);
  });
});
