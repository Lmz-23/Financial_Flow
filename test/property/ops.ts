// Generador de operaciones aleatorias y comparacion con el modelo (ver cabecera de model.test.ts).
//
// Una secuencia = BD en memoria con dos usuarios (el principal y "otro", con datos de todas las clases)
// + N operaciones elegidas por una semilla. Tras cada operacion ACEPTADA se compara el estado completo
// de los servicios con el del modelo; cada operacion RECHAZADA debe lanzar el error tipado que predice el
// modelo y dejar las 10 tablas identicas. Los ids del otro usuario se usan en todas las clases de operacion
// y el modelo los trata como inexistentes (NOT_FOUND).
import { DEFAULT_USER_ID } from '../../src/database/seed';
import type {
  CreateRecurringInput,
  DomainErrorCode,
  UpdateGoalInput,
  UpdateRecurringInput,
} from '../../src/domain/services';
import { secondUserDomain, setup, snapshot } from '../integration/domain/_helpers';
import {
  addDays, addMonths, DAY, fmt, H, inSeries, midnightMs, nextPending, normalizeAnchor, parts, shiftMonth,
  type Frequency,
} from './calendar';
import { Model, type ModelDebt, type ModelRecurring, type ModelTransfer } from './model';
import { createRng } from './random';

export interface Stats {
  ops: number;
  accepted: Record<string, number>;
  rejected: Record<string, number>;
  byCode: Record<string, number>;
  coverage: Record<string, number>;
}

export const newStats = (): Stats => ({ ops: 0, accepted: {}, rejected: {}, byCode: {}, coverage: {} });

export interface SequenceResult {
  /** null si el dominio y el modelo coincidieron en toda la secuencia. */
  divergence: string | null;
  /** Operaciones ejecutadas hasta la divergencia (indice 1-based de la ultima). */
  executed: number;
  log: string[];
}

const OTHER_USER = 'otro';
const BAD_YEAR = ['0000-01-01', '0050-06-15', '0099-12-31'];
const BAD_FORMAT = ['2026-02-30', 'abcd', '2026-13-01', '99999-01-01', '2026-1-1'];
const ACCOUNT_TYPES = ['CASH', 'SAVINGS', 'CHECKING', 'DIGITAL_WALLET'] as const;
const FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
const MISSING = 'no-existe';
const ALL_TABLES = [
  'users', 'accounts', 'categories', 'debts', 'goals', 'recurring_items',
  'transactions', 'goal_contributions', 'account_transfers', 'balance_adjustments',
];

const bump = (rec: Record<string, number>, key: string): void => {
  rec[key] = (rec[key] ?? 0) + 1;
};

function errorCode(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'string') return code;
  const err = e as Error;
  return `JS:${err?.constructor?.name}:${String(err?.message).slice(0, 80)}`;
}

type DateInput = { v: string; bad: 'YEAR' | 'FORMAT' | null };
type ForeignKind = 'account' | 'transaction' | 'transfer' | 'debt' | 'goal' | 'recurring' | 'category';

export function runSequence(seed: number, nOps: number, stats: Stats): SequenceResult {
  const rng = createRng(seed);
  const { int: ri, pick, chance } = rng;

  const env = setup();
  const A = env.d;
  const M = new Model(env.clock);
  env.clock.now = midnightMs(fmt(2026, ri(1, 12), ri(1, 28))) + 12 * H;
  const B = secondUserDomain(env, OTHER_USER);
  const snap = (): string => snapshot(env);

  // ---- el otro usuario: datos de todas las clases (ids "ajenos" para el usuario principal) ----------
  const today0 = M.today();
  const fAcc = B.accounts.create({ name: 'Ajena', type: 'CASH', openingMinor: 100_000 }).result.id;
  const fArch = B.accounts.create({ name: 'AjenaA', type: 'CASH', openingMinor: 5 }).result.id;
  B.transactions.create({ type: 'EXPENSE', accountId: fArch, amountMinor: 1 });
  B.accounts.remove(fArch);
  const fTx = B.transactions.create({
    type: 'EXPENSE', accountId: fAcc, amountMinor: 10, newCategoryName: 'Categoria ajena',
  }).result.id;
  const fCat = B.transactions.categories('EXPENSE').find((c) => c.userId === OTHER_USER)?.id ?? '';
  const fDebt = B.debts.create({
    name: 'Deuda ajena', balanceMinor: 90_000, installmentMinor: 9_000, rate: { known: 0.01 },
    nextDueDate: addDays(today0, 5),
  }).result;
  const fDebtOccurrence = addDays(today0, 5);
  const fDebtTx = B.debts.registerPayment({
    debtId: fDebt.id, accountId: fAcc, amountMinor: 9_000, type: 'INSTALLMENT',
  }).result.transactionId;
  const fAcc2 = B.accounts.create({ name: 'Ajena2', type: 'CASH', openingMinor: 0 }).result.id;
  const fXfer = B.transfers.create({ fromAccountId: fAcc, toAccountId: fAcc2, amountMinor: 700 }).result.id;
  const fGoal = B.goals.create({ name: 'Meta ajena', targetMinor: 1_000_000 }).result.id;
  B.goals.contribute({ goalId: fGoal, accountId: fAcc, amountMinor: 100 });
  const fRecOccurrence = addDays(today0, -3);
  const fRec = B.recurring.create({
    type: 'EXPENSE', name: 'Recurrente ajeno', amountMinor: 500, frequency: 'MONTHLY', anchorDate: fRecOccurrence,
  }).result.id;
  const fRecTx = B.recurring.confirmOccurrence({
    recurringId: fRec, occurrenceDate: fRecOccurrence, accountId: fAcc,
  }).result.transactionId;
  const foreign: Record<ForeignKind, string[]> = {
    account: [fAcc, fArch, fAcc2],
    transaction: [fTx, fDebtTx, fRecTx],
    transfer: [fXfer],
    debt: [fDebt.id],
    goal: [fGoal],
    recurring: [fRec, fDebt.recurringId ?? ''],
    category: [fCat],
  };
  const foreignIds = new Set(Object.values(foreign).flat());

  /** Lo que el otro usuario debe seguir viendo (y teniendo en BD) pase lo que pase con el principal. */
  const [baseYear, baseMonth] = parts(today0);
  const viewsOfOther = (): string =>
    JSON.stringify([
      B.accounts.summary(),
      B.transactions.list(),
      B.transfers.list(),
      B.activity.list(),
      B.debts.list().map((x) => [x.id, x.balanceMinor, x.paidCount, x.nextDueDate]),
      B.goals.list().map((x) => [x.id, x.savedMinor, x.status]),
      B.recurring.list().map((x) => [x.id, x.nextDueDate]),
      B.reports.netWorth(),
      B.reports.monthStatement(baseYear, baseMonth),
      B.integrity.check(),
    ]);
  const rowsOfOther = (): string =>
    JSON.stringify(
      ALL_TABLES.map((t) => [
        t,
        env.sqlite
          .prepare(`select * from ${t} where ${t === 'users' ? 'id' : 'user_id'} = ? order by rowid`)
          .all(OTHER_USER),
      ]),
    );
  const baselineViews = viewsOfOther();
  let comparisons = 0;
  const baselineRows = rowsOfOther();

  const log: string[] = [];
  let foreignUsed: ForeignKind | null = null;
  /** Un id que NO es del usuario principal: inexistente o del otro usuario (indistinguibles). */
  const foreignId = (kind: ForeignKind): string => {
    foreignUsed = kind;
    return pick(foreign[kind]);
  };
  const unknownId = (kind: ForeignKind): string => (chance(0.5) ? MISSING : foreignId(kind));

  const accIds = (): string[] => [...M.accounts.keys()];
  const archivedIds = (): string[] => accIds().filter((a) => M.accounts.get(a)?.archived);
  const activeIds = (): string[] => accIds().filter((a) => !M.accounts.get(a)?.archived);
  const anyAcc = (): string => (accIds().length > 0 && chance(0.95) ? pick(accIds()) : unknownId('account'));
  const goalIds = (): string[] => [...M.goals.keys()];
  const debtIds = (): string[] => [...M.debts.keys()];
  const recIds = (): string[] => [...M.recurring.keys()];
  const anyGoal = (): string => (goalIds().length > 0 && chance(0.95) ? pick(goalIds()) : unknownId('goal'));
  const anyDebt = (): string => (debtIds().length > 0 && chance(0.95) ? pick(debtIds()) : unknownId('debt'));
  const standardRecIds = (): string[] => recIds().filter((x) => M.recurring.get(x)?.kind === 'STANDARD');
  const debtRecurring = (debtId: string): ModelRecurring | undefined =>
    [...M.recurring.values()].find((x) => x.debtId === debtId);
  /** Categorias propias creadas con `newCategoryName`, por tipo de movimiento. */
  const ownCategories = new Map<'INCOME' | 'EXPENSE', string>();
  let counter = 0;

  function dateInput(rel = 0, allowMax = false): DateInput {
    const r = rng.next();
    if (r < 0.1) return { v: pick(BAD_YEAR), bad: 'YEAR' };
    if (r < 0.14) return { v: pick(BAD_FORMAT), bad: 'FORMAT' };
    if (r < 0.17) return { v: allowMax ? '0100-01-01' : '0100-03-10', bad: null };
    if (r < 0.19) return { v: allowMax ? '9999-12-31' : '2999-12-31', bad: null };
    return { v: addDays(M.today(), ri(-200, 900) + rel), bad: null };
  }

  /** Ejecuta una operacion del dominio principal y compara con la prediccion del modelo. */
  function exec<R>(
    name: string,
    call: () => R,
    expected: DomainErrorCode | null,
    apply: (res: R) => void,
  ): string | null {
    stats.ops++;
    const before = snap();
    let res: R | undefined;
    let err: unknown = null;
    try {
      res = call();
    } catch (e) {
      err = e;
    }
    if (foreignUsed !== null) {
      bump(stats.coverage, `id ajeno (${foreignUsed}) en ${name}`);
      foreignUsed = null;
    }
    log.push(`${log.length + 1} ${name} esperado=${expected ?? 'OK'} obtenido=${err ? errorCode(err) : 'OK'}`);
    if (err) {
      const code = errorCode(err);
      bump(stats.rejected, name);
      bump(stats.byCode, code);
      if (expected === null) return `${name}: se esperaba exito y lanzo ${code} (${String((err as Error).message).slice(0, 120)})`;
      if (code !== expected) return `${name}: error esperado ${expected} y se obtuvo ${code}`;
      if (snap() !== before) return `${name}: la operacion rechazada (${code}) CAMBIO la BD`;
      return null;
    }
    bump(stats.accepted, name);
    if (expected !== null) return `${name}: se esperaba ${expected} y la operacion se acepto`;
    apply(res as R);
    return compareAll();
  }

  /** El OTRO usuario opera con un id del principal: NOT_FOUND y la BD identica (10 tablas). */
  function mustNotFound(name: string, call: () => unknown): string | null {
    stats.ops++;
    const before = snap();
    let err: unknown = null;
    try {
      call();
    } catch (e) {
      err = e;
    }
    const code = err ? errorCode(err) : 'OK';
    log.push(`${log.length + 1} ajeno.${name} esperado=NOT_FOUND obtenido=${code}`);
    bump(err ? stats.rejected : stats.accepted, `ajeno.${name}`);
    if (err) bump(stats.byCode, code);
    if (!err) return `ajeno.${name}: el otro usuario opero sobre datos del principal y se acepto`;
    if (code !== 'NOT_FOUND') return `ajeno.${name}: se esperaba NOT_FOUND y se obtuvo ${code}`;
    if (snap() !== before) return `ajeno.${name}: la operacion rechazada CAMBIO la BD`;
    return null;
  }

  /** Lectura del otro usuario con un id del principal: igual que un id inexistente. */
  function mustReadEmpty(name: string, read: () => unknown, empty: unknown): string | null {
    stats.ops++;
    log.push(`${log.length + 1} ajeno.${name} esperado=vacio`);
    bump(stats.accepted, `ajeno.${name}`);
    return JSON.stringify(read()) === JSON.stringify(empty) ? null : `ajeno.${name}: devolvio datos del principal`;
  }

  function compareAll(): string | null {
    try {
      for (const [id, a] of M.accounts) {
        const v = A.accounts.get(id);
        if (!v) throw new Error(`cuenta ${id} no existe en BD`);
        if ((v.archivedAt !== null) !== a.archived) throw new Error(`archivada ${id}: BD=${v.archivedAt !== null} modelo=${a.archived}`);
        if (v.availableMinor !== M.available(id)) throw new Error(`disponible ${id}: BD=${v.availableMinor} modelo=${M.available(id)}`);
      }
      const summary = A.accounts.summary();
      const active = activeIds().sort();
      if (JSON.stringify(summary.accounts.map((a) => a.id).sort()) !== JSON.stringify(active)) throw new Error('summary ids distintos');
      const total = active.reduce((s, id) => s + M.available(id), 0);
      if (summary.totalMinor !== total) throw new Error(`total cuentas BD=${summary.totalMinor} modelo=${total}`);
      // transferencias y actividad unificada
      const xferList = A.transfers.list();
      if (JSON.stringify(xferList.map((x) => x.id).sort()) !== JSON.stringify(M.transfers.map((x) => x.id).sort())) throw new Error('transfers.list ids distintos');
      for (const x of xferList) {
        const mt = M.transfers.find((t) => t.id === x.id);
        if (!mt || mt.from !== x.fromAccountId || mt.to !== x.toAccountId || mt.amount !== x.amountMinor || mt.date !== x.date) throw new Error(`transferencia ${x.id} distinta del modelo`);
      }
      const activity = A.activity.list();
      if (activity.length !== M.txs.length + M.transfers.length) throw new Error(`activity: ${activity.length} items vs ${M.txs.length + M.transfers.length}`);
      for (let i = 1; i < activity.length; i++) if (activity[i - 1].date < activity[i].date) throw new Error('activity no esta ordenada por fecha desc');
      // deudas
      const debtList = A.debts.list();
      const liveDebts = debtIds().filter((x) => !M.debts.get(x)?.archived).sort();
      if (JSON.stringify(debtList.map((x) => x.id).sort()) !== JSON.stringify(liveDebts)) throw new Error('debts.list ids distintos');
      for (const v of debtList) {
        if (v.balanceMinor !== M.debtBalance(v.id)) throw new Error(`saldo deuda ${v.id}: BD=${v.balanceMinor} modelo=${M.debtBalance(v.id)}`);
        const rec = debtRecurring(v.id);
        if (v.nextDueDate !== (rec ? rec.next : null)) throw new Error(`nextDueDate deuda ${v.id}: BD=${v.nextDueDate} modelo=${rec?.next ?? null}`);
      }
      // metas
      const goalList = A.goals.list();
      if (JSON.stringify(goalList.map((x) => x.id).sort()) !== JSON.stringify(goalIds().sort())) throw new Error('goals.list ids distintos');
      for (const v of goalList) {
        const g = M.goals.get(v.id);
        if (!g) throw new Error(`meta ${v.id} desconocida para el modelo`);
        if (v.status !== g.status) throw new Error(`status meta ${v.id}`);
        const expectedSaved = g.status === 'SPENT' ? g.spent : M.saved(g.id);
        if (v.savedMinor !== expectedSaved) throw new Error(`saved meta ${v.id}: BD=${v.savedMinor} modelo=${expectedSaved}`);
        const eta = M.eta(g);
        bump(stats.coverage, `eta: ${eta.tag}`);
        if (JSON.stringify(v.eta) !== JSON.stringify(eta.value)) {
          throw new Error(`eta meta ${v.id}: BD=${JSON.stringify(v.eta)} modelo=${JSON.stringify(eta.value)} (target=${g.target} date=${g.targetDate} today=${M.today()})`);
        }
        if (JSON.stringify(A.goals.get(v.id)?.eta) !== JSON.stringify(eta.value)) throw new Error(`goals.get eta distinto de list/modelo ${v.id}`);
        const etaDate = (v.eta as { date?: string } | null)?.date;
        if (etaDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(etaDate)) throw new Error(`eta.date no es de 4 digitos: ${etaDate}`);
      }
      // estado del mes (actual y 2 anteriores) y patrimonio
      const [cy, cm] = parts(M.today());
      for (let k = 0; k <= 2; k++) {
        const [yy, mm] = shiftMonth(cy, cm, -k);
        const real = A.reports.monthStatement(yy, mm);
        const expected = M.statement(yy, mm);
        if (JSON.stringify(real) !== JSON.stringify(expected)) throw new Error(`estado ${yy}-${mm}: BD=${JSON.stringify(real)} modelo=${JSON.stringify(expected)}`);
      }
      const netWorth = A.reports.netWorth();
      if (netWorth !== M.netWorth()) throw new Error(`patrimonio BD=${netWorth} modelo=${M.netWorth()}`);
      // recurrentes
      const recList = A.recurring.list();
      if (JSON.stringify(recList.map((x) => x.id).sort()) !== JSON.stringify(standardRecIds().sort())) throw new Error('recurring.list ids distintos');
      for (const r of recList) {
        const m = M.recurring.get(r.id);
        if (!m || r.anchorDate !== m.anchor || r.nextDueDate !== m.next || r.snoozedUntil !== m.snoozedUntil) throw new Error(`recurrente ${r.id}: BD anchor=${r.anchorDate} next=${r.nextDueDate} snooze=${r.snoozedUntil} modelo anchor=${m?.anchor} next=${m?.next} snooze=${m?.snoozedUntil}`);
      }
      const upcoming = A.recurring.upcoming();
      const today = M.today();
      const month = today.slice(0, 7);
      const expectedUpcoming = new Map<string, { next: string; status: string; snoozedUntil: number | null }>();
      for (const r of M.recurring.values()) {
        if (r.next === null) continue;
        if (r.kind === 'DEBT') {
          const debt = r.debtId !== undefined ? M.debts.get(r.debtId) : undefined;
          if (!debt || debt.archived || M.debtBalance(debt.id) <= 0) continue;
        }
        const paid = !r.next.startsWith(month) && [...M.confirmed(r.id)].some((o) => o.startsWith(month));
        expectedUpcoming.set(r.id, { next: r.next, status: paid ? 'PAID' : r.next < today ? 'OVERDUE' : 'PENDING', snoozedUntil: r.snoozedUntil });
      }
      if (upcoming.length !== expectedUpcoming.size) throw new Error(`upcoming: ${upcoming.length} items vs ${expectedUpcoming.size}`);
      for (const u of upcoming) {
        const e = expectedUpcoming.get(u.recurringId);
        if (!e || e.next !== u.nextDueDate || e.status !== u.status || e.snoozedUntil !== u.snoozedUntil) throw new Error(`upcoming ${u.recurringId}: BD=${u.nextDueDate}/${u.status} modelo=${JSON.stringify(e)}`);
      }
      // integridad del principal y aislamiento del otro usuario
      const report = A.integrity.check();
      if (!report.ok || report.violations.length > 0) throw new Error(`INTEGRIDAD: ${JSON.stringify(report.violations)}`);
      if (A.recurring.pendingOccurrences().some((p) => foreignIds.has(p.recurringId))) throw new Error('pendingOccurrences incluye datos del otro usuario');
      if (
        A.accounts.get(fAcc) !== undefined || A.transfers.get(fXfer) !== undefined || A.transactions.get(fTx) !== undefined || A.debts.get(fDebt.id) !== undefined ||
        A.goals.get(fGoal) !== undefined || A.debts.payments(fDebt.id).length > 0 || A.goals.contributions(fGoal).length > 0
      ) {
        throw new Error('el usuario principal ve datos del otro usuario');
      }
      // Las vistas por servicio del otro usuario son caras: se comprueban cada 8 comparaciones y al final.
      if (++comparisons % 8 === 0 && viewsOfOther() !== baselineViews) throw new Error('las vistas del otro usuario cambiaron');
      if (rowsOfOther() !== baselineRows) throw new Error('las filas del otro usuario cambiaron en BD');
    } catch (e) {
      return `COMPARACION: ${(e as Error).message}`;
    }
    return null;
  }

  // ---- estado inicial del usuario principal
  for (let i = 0; i < 2; i++) {
    const opening = ri(0, 100000);
    const r = A.accounts.create({ name: `I${i}`, type: pick(ACCOUNT_TYPES), openingMinor: opening });
    M.accounts.set(r.result.id, { archived: false });
    if (opening) M.adjustments.push({ kind: 'ACCOUNT', id: r.result.id, delta: opening });
  }

  function createDebtRecurring(debtId: string, date: string, recurringId: string): void {
    M.recurring.set(recurringId, {
      id: recurringId, kind: 'DEBT', debtId, type: 'EXPENSE', amount: 0, passive: false,
      frequency: 'MONTHLY', anchor: date, next: date, snoozedUntil: null,
    });
  }

  // =========================================================================================
  // Operaciones: cada rama genera la entrada, predice resultado/error con el modelo y ejecuta.
  // =========================================================================================

  function accountOps(r: number): string | null | undefined {
    if (r < 5) {
      const opening = pick([0, ri(1, 500000), -ri(1, 10000)]);
      const bad = chance(0.05);
      const name = bad ? '' : `A${++counter}`;
      return exec('accounts.create', () => A.accounts.create({ name, type: pick(ACCOUNT_TYPES), openingMinor: bad ? 1.5 : opening }), bad ? 'VALIDATION' : null, (res) => {
        M.accounts.set(res.result.id, { archived: false });
        if (opening) M.adjustments.push({ kind: 'ACCOUNT', id: res.result.id, delta: opening });
      });
    }
    if (r < 8) {
      const id = anyAcc();
      const a = M.accounts.get(id);
      const useBalance = chance(0.7);
      const newBalance = useBalance ? (chance(0.3) ? M.available(id) : ri(-5000, 800000)) : undefined;
      const expected = !a ? 'NOT_FOUND' : a.archived ? 'ACCOUNT_ARCHIVED' : null;
      return exec('accounts.update', () => A.accounts.update(id, newBalance !== undefined ? { balanceMinor: newBalance } : { name: `R${++counter}` }), expected, () => {
        if (newBalance !== undefined && newBalance !== M.available(id)) M.adjustments.push({ kind: 'ACCOUNT', id, delta: newBalance - M.available(id) });
      });
    }
    if (r < 12) {
      const id = anyAcc();
      const a = M.accounts.get(id);
      const expected = !a ? 'NOT_FOUND' : a.archived ? 'VALIDATION' : null;
      return exec('accounts.remove', () => A.accounts.remove(id), expected, (res) => {
        const hasMovements =
          M.txs.some((x) => x.accountId === id) || M.contributions.some((x) => x.accountId === id) ||
          M.transfers.some((x) => x.from === id || x.to === id);
        if (res.result.outcome !== (hasMovements ? 'ARCHIVED' : 'DELETED')) throw new Error('outcome distinto');
        if (!hasMovements) {
          M.adjustments = M.adjustments.filter((x) => !(x.kind === 'ACCOUNT' && x.id === id));
          M.accounts.delete(id);
        } else {
          const av = M.available(id);
          if (av !== 0) M.adjustments.push({ kind: 'ACCOUNT', id, delta: -av });
          if (a) a.archived = true;
        }
      });
    }
    if (r < 20) { // DESARCHIVAR (tambien cuentas inexistentes, ajenas, y no archivadas)
      const r2 = rng.next();
      const id = r2 < 0.1 ? MISSING : r2 < 0.25 ? foreignId('account') : archivedIds().length > 0 && chance(0.8) ? pick(archivedIds()) : anyAcc();
      const a = M.accounts.get(id);
      const expected = !a ? 'NOT_FOUND' : !a.archived ? 'VALIDATION' : null;
      return exec('accounts.unarchive', () => A.accounts.unarchive(id), expected, (res) => {
        if (a) a.archived = false;
        M.unarchived.add(id);
        if (res.result.id !== id) throw new Error('result.id');
        if (!(res.effects.refresh.includes('accounts') && res.effects.refresh.includes('goals'))) throw new Error('effects.refresh sin accounts/goals');
      });
    }
    if (r < 22) { // ajuste heredado por SQL sobre una cuenta (preferentemente archivada)
      const ids = archivedIds().length > 0 && chance(0.7) ? archivedIds() : accIds();
      if (ids.length === 0) return null;
      const id = pick(ids);
      const delta = pick([ri(1, 5000), -ri(1, 5000)]);
      stats.ops++;
      env.sqlite
        .prepare("insert into balance_adjustments (id, user_id, target_type, account_id, previous_minor, new_minor, delta_minor, reason, created_at) values (?, ?, 'ACCOUNT', ?, 0, ?, ?, 'MANUAL', 0)")
        .run(`sql-${seed}-${++counter}`, DEFAULT_USER_ID, id, delta, delta);
      M.adjustments.push({ kind: 'ACCOUNT', id, delta });
      bump(stats.accepted, 'sql.inheritedAdjust');
      return compareAll();
    }
    return undefined;
  }

  function transactionOps(r: number): string | null | undefined {
    if (r < 36) {
      const id = anyAcc();
      const a = M.accounts.get(id);
      const type = pick(['INCOME', 'EXPENSE'] as const);
      const amount = chance(0.05) ? 0 : ri(1, 200000);
      const passive = chance(0.15);
      const date = chance(0.4) ? midnightMs(addDays(M.today(), -ri(0, 70))) + 12 * H : undefined;
      // Categoria: ninguna, propia del tipo, ajena (NOT_FOUND) o nueva en linea.
      const catRoll = rng.next();
      let categoryId: string | undefined;
      let newCategoryName: string | undefined;
      let foreignCategory = false;
      if (catRoll < 0.07) {
        categoryId = foreignId('category');
        foreignCategory = true;
      } else if (catRoll < 0.17 && ownCategories.has(type)) categoryId = ownCategories.get(type);
      else if (catRoll < 0.27) newCategoryName = `Cat ${type}`;
      let expected: DomainErrorCode | null = null;
      if (amount <= 0) expected = 'VALIDATION';
      else if (passive && type !== 'INCOME') expected = 'VALIDATION';
      else if (!a) expected = 'NOT_FOUND';
      else if (a.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (foreignCategory) expected = 'NOT_FOUND';
      return exec('transactions.create', () => A.transactions.create({ type, accountId: id, amountMinor: amount, isPassive: passive, date, categoryId, newCategoryName }), expected, (res) => {
        M.txs.push({ id: res.result.id, accountId: id, type, amount, kind: 'STANDARD', passive, date: date ?? env.clock.now, recurringId: null, occurrence: null });
        if (M.unarchived.has(id)) bump(stats.coverage, 'tx.create sobre cuenta desarchivada');
        if (categoryId !== undefined) bump(stats.coverage, 'tx.create con categoria propia');
        if (newCategoryName !== undefined) {
          const created = A.transactions.categories(type).find((c) => c.userId === DEFAULT_USER_ID && c.name === newCategoryName);
          if (!created) throw new Error('la categoria en linea no se creo');
          ownCategories.set(type, created.id);
        }
      });
    }
    if (r < 42) {
      const tx = M.txs.length > 0 && chance(0.9) ? pick(M.txs) : undefined;
      const id = tx ? tx.id : unknownId('transaction');
      const expected = !tx ? 'NOT_FOUND' : M.accounts.get(tx.accountId)?.archived ? 'ACCOUNT_ARCHIVED' : null;
      return exec('transactions.remove', () => A.transactions.remove(id), expected, () => {
        if (!tx) return;
        if (M.unarchived.has(tx.accountId)) bump(stats.coverage, 'borrado de tx sobre cuenta desarchivada');
        M.removeTx(tx);
      });
    }
    return undefined;
  }

  /** Transferencias entre cuentas y edicion de transacciones (decision 2026-10-27). */
  function transferOps(): string | null {
    const r = rng.next();
    if (r < 0.34) { // create
      const from = anyAcc();
      const to = chance(0.06) ? from : anyAcc();
      const a = M.accounts.get(from);
      const b = M.accounts.get(to);
      const av = a ? M.available(from) : 0;
      const amount = chance(0.04) ? 0 : chance(0.2) && av > 0 ? av : chance(0.1) ? av + 1 : ri(1, 80000);
      const date = chance(0.5) ? env.clock.now - ri(0, 100) * DAY : undefined;
      let expected: DomainErrorCode | null = null;
      if (amount <= 0) expected = 'VALIDATION';
      else if (from === to) expected = 'VALIDATION';
      else if (!a) expected = 'NOT_FOUND';
      else if (a.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (!b) expected = 'NOT_FOUND';
      else if (b.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (amount > av) expected = 'INSUFFICIENT_FUNDS';
      return exec('transfers.create', () => A.transfers.create({ fromAccountId: from, toAccountId: to, amountMinor: amount, date, note: chance(0.3) ? ' nota ' : undefined }), expected, (res) => {
        M.transfers.push({ id: res.result.id, from, to, amount, date: date ?? env.clock.now });
        if (amount === av) bump(stats.coverage, 'transferencia por todo el disponible');
      });
    }
    if (r < 0.7) { // update
      const old: ModelTransfer | undefined = M.transfers.length > 0 && chance(0.92) ? pick(M.transfers) : undefined;
      const id = old ? old.id : unknownId('transfer');
      const input: { fromAccountId?: string; toAccountId?: string; amountMinor?: number; date?: number; note?: string } = {};
      if (chance(0.6)) input.amountMinor = chance(0.04) ? 0 : old && chance(0.25) ? old.amount : chance(0.2) ? M.available(old?.from ?? '') + (old?.amount ?? 0) : ri(1, 80000);
      if (chance(0.3)) input.fromAccountId = chance(0.05) ? MISSING : anyAcc();
      if (chance(0.3)) input.toAccountId = chance(0.05) ? MISSING : anyAcc();
      if (chance(0.3)) input.date = env.clock.now - ri(0, 100) * DAY;
      if (chance(0.3)) input.note = pick(['', 'otra nota', '   ']);
      const newFrom = input.fromAccountId ?? old?.from ?? '';
      const newTo = input.toAccountId ?? old?.to ?? '';
      const amount = input.amountMinor ?? old?.amount ?? 0;
      let expected: DomainErrorCode | null = null;
      if (!old) expected = 'NOT_FOUND';
      else if (amount <= 0) expected = 'VALIDATION';
      else if (newFrom === newTo) expected = 'VALIDATION';
      else if (M.accounts.get(old.from)?.archived || M.accounts.get(old.to)?.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (!M.accounts.get(newFrom)) expected = 'NOT_FOUND';
      else if (M.accounts.get(newFrom)?.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (!M.accounts.get(newTo)) expected = 'NOT_FOUND';
      else if (M.accounts.get(newTo)?.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (newFrom !== old.from || amount > old.amount) {
        const free = M.available(newFrom) + (old.from === newFrom ? old.amount : 0) - (old.to === newFrom ? old.amount : 0);
        if (amount > free) expected = 'INSUFFICIENT_FUNDS';
      }
      return exec('transfers.update', () => A.transfers.update(id, input), expected, () => {
        if (!old) return;
        old.from = newFrom;
        old.to = newTo;
        old.amount = amount;
        if (input.date !== undefined) old.date = input.date;
      });
    }
    if (r < 0.82) { // remove
      const old = M.transfers.length > 0 && chance(0.92) ? pick(M.transfers) : undefined;
      const id = old ? old.id : unknownId('transfer');
      const expected = !old ? 'NOT_FOUND' : M.accounts.get(old.from)?.archived || M.accounts.get(old.to)?.archived ? 'ACCOUNT_ARCHIVED' : null;
      return exec('transfers.remove', () => A.transfers.remove(id), expected, () => {
        M.transfers = M.transfers.filter((t) => t !== old);
      });
    }
    // transactions.update
    const tx = M.txs.length > 0 && chance(0.92) ? pick(M.txs) : undefined;
    const id = tx ? tx.id : unknownId('transaction');
    const input: { amountMinor?: number; accountId?: string; date?: number; description?: string; isPassive?: boolean } = {};
    if (chance(0.6)) input.amountMinor = chance(0.05) ? 0 : ri(1, 200000);
    if (chance(0.3)) input.accountId = chance(0.05) ? MISSING : anyAcc();
    if (chance(0.3)) input.date = chance(0.5) && tx ? tx.date : midnightMs(addDays(M.today(), -ri(0, 70))) + 12 * H;
    if (chance(0.3)) input.description = pick(['', 'editada']);
    if (chance(0.3)) input.isPassive = chance(0.5);
    let expected: DomainErrorCode | null = null;
    if (!tx) expected = 'NOT_FOUND';
    else if (tx.kind === 'DEBT_PAYMENT') expected = 'TRANSACTION_NOT_EDITABLE';
    else if (input.amountMinor !== undefined && input.amountMinor <= 0) expected = 'VALIDATION';
    else if (tx.recurringId !== null && input.date !== undefined && input.date !== tx.date) expected = 'TRANSACTION_NOT_EDITABLE';
    else if (M.accounts.get(tx.accountId)?.archived) expected = 'ACCOUNT_ARCHIVED';
    else if (input.accountId !== undefined && input.accountId !== tx.accountId) {
      const target = M.accounts.get(input.accountId);
      if (!target) expected = 'NOT_FOUND';
      else if (target.archived) expected = 'ACCOUNT_ARCHIVED';
    }
    return exec('transactions.update', () => A.transactions.update(id, input), expected, () => {
      if (!tx) return;
      if (input.amountMinor !== undefined) tx.amount = input.amountMinor;
      if (input.accountId !== undefined) tx.accountId = input.accountId;
      if (input.date !== undefined) tx.date = input.date;
      tx.passive = tx.type === 'INCOME' ? (input.isPassive ?? tx.passive) : false;
      if (tx.recurringId !== null) bump(stats.coverage, 'edicion de tx ligada a recurrente');
    });
  }

  function goalOps(r: number): string | null | undefined {
    if (r < 50) {
      const acc = anyAcc();
      const a = M.accounts.get(acc);
      const target = chance(0.1) ? 300_000_000 : chance(0.04) ? 9_000_000_000_000_000 : ri(1, 1_000_000);
      const initial = chance(0.5) ? 0 : ri(1, 60000);
      const useAcc = chance(0.93);
      const dt = chance(0.55) && target <= 300_000_000 ? dateInput(0, true) : null;
      let expected: DomainErrorCode | null = null;
      if (initial > 0 && !useAcc) expected = 'VALIDATION';
      else if (dt?.bad) expected = 'VALIDATION';
      else if (initial > 0) {
        if (!a) expected = 'NOT_FOUND';
        else if (a.archived) expected = 'ACCOUNT_ARCHIVED';
        else if (initial > M.available(acc)) expected = 'INSUFFICIENT_FUNDS';
      }
      return exec('goals.create', () => A.goals.create({ name: `G${++counter}`, targetMinor: target, initialMinor: initial || undefined, accountId: useAcc ? acc : undefined, targetDate: dt ? dt.v : undefined }), expected, (res) => {
        M.goals.set(res.result.id, { id: res.result.id, target, targetDate: dt ? dt.v : null, status: 'ACTIVE', spent: 0, spentAt: 0 });
        if (initial > 0) M.contributions.push({ goalId: res.result.id, accountId: acc, amount: initial, date: env.clock.now });
      });
    }
    if (r < 60) {
      const goalId = anyGoal();
      const g = M.goals.get(goalId);
      const acc = anyAcc();
      const a = M.accounts.get(acc);
      const av = a ? M.available(acc) : 0;
      const amount = chance(0.04) ? 0 : chance(0.2) && av > 0 ? av : chance(0.1) ? av + 1 : ri(1, 80000);
      const date = chance(0.5) ? env.clock.now - ri(0, 100) * DAY : chance(0.05) ? env.clock.now + 3 * DAY : undefined;
      let expected: DomainErrorCode | null = null;
      if (!g) expected = 'NOT_FOUND';
      else if (g.status !== 'ACTIVE') expected = 'GOAL_NOT_ACTIVE';
      else if (amount <= 0) expected = 'VALIDATION';
      else if (!a) expected = 'NOT_FOUND';
      else if (a.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (amount > av) expected = 'INSUFFICIENT_FUNDS';
      return exec('goals.contribute', () => A.goals.contribute({ goalId, accountId: acc, amountMinor: amount, date }), expected, () => {
        M.contributions.push({ goalId, accountId: acc, amount, date: date ?? env.clock.now });
        if (M.unarchived.has(acc)) bump(stats.coverage, 'aporte desde cuenta desarchivada');
      });
    }
    if (r < 68) {
      const goalId = anyGoal();
      const g = M.goals.get(goalId);
      const kind = pick(['target', 'saved', 'date', 'date', 'edge', 'datenull', 'name']);
      const input: UpdateGoalInput = {};
      let expected: DomainErrorCode | null = null;
      let applyFn: () => void = () => {};
      if (!g) expected = 'NOT_FOUND';
      else if (g.status !== 'ACTIVE') expected = 'GOAL_NOT_ACTIVE';
      else if (kind === 'target') {
        const v = chance(0.1) ? 0 : chance(0.3) ? Math.max(1, M.saved(goalId)) : ri(1, 1_000_000);
        input.targetMinor = v;
        if (v <= 0) expected = 'VALIDATION';
        else applyFn = () => { g.target = v; };
      } else if (kind === 'saved') {
        const v = chance(0.1) ? -5 : ri(0, 900000);
        input.savedMinor = v;
        if (v < 0) expected = 'VALIDATION';
        else applyFn = () => {
          const current = M.saved(goalId);
          if (v !== current) M.adjustments.push({ kind: 'GOAL', id: goalId, delta: v - current });
        };
      } else if (kind === 'date') {
        const dt = dateInput(0, true);
        input.targetDate = dt.v;
        if (dt.bad) expected = 'VALIDATION';
        else if (g.target > 1e12) return null; // metas enormes: no se mezclan con fechas lejanas
        else applyFn = () => { g.targetDate = dt.v; };
      } else if (kind === 'datenull') {
        input.targetDate = null;
        applyFn = () => { g.targetDate = null; };
      } else if (kind === 'edge') { // dejar la meta en el borde del tope de 1200 meses del ETA
        let windowTotal = 0;
        const [y, m] = parts(M.today());
        const [wy, wm] = shiftMonth(y, m, -2);
        const windowStart = midnightMs(fmt(wy, wm, 1));
        for (const c of M.contributions) {
          if (c.goalId === goalId && c.date >= windowStart && c.date <= env.clock.now) windowTotal += c.amount;
        }
        const v = M.saved(goalId) + 400 * windowTotal + pick([-1, 0, 1, 2, 3]);
        if (v <= 0) return null;
        input.targetMinor = v;
        input.targetDate = null;
        applyFn = () => { g.target = v; g.targetDate = null; };
      } else input.name = `N${++counter}`;
      return exec('goals.update', () => A.goals.update(goalId, input), expected, applyFn);
    }
    if (r < 71) {
      // Cerrar solo es posible con la meta alcanzada: se prefiere una meta alcanzada cuando existe.
      const reached = goalIds().filter((id) => {
        const goal = M.goals.get(id);
        return goal?.status === 'ACTIVE' && M.saved(id) >= goal.target;
      });
      const goalId = reached.length > 0 && chance(0.7) ? pick(reached) : anyGoal();
      const g = M.goals.get(goalId);
      const saved = g ? M.saved(goalId) : 0;
      const expected = !g ? 'NOT_FOUND' : g.status !== 'ACTIVE' ? 'GOAL_NOT_ACTIVE' : saved < g.target ? 'GOAL_NOT_REACHED' : null;
      return exec('goals.close', () => A.goals.close(goalId), expected, () => {
        if (!g) return;
        g.status = 'SPENT';
        g.spent = saved;
        g.spentAt = env.clock.now;
      });
    }
    if (r < 77) {
      const goalId = anyGoal();
      const g = M.goals.get(goalId);
      const r2 = rng.next();
      const dest = r2 < 0.15 ? undefined : r2 < 0.25 ? foreignId('account') : r2 < 0.3 ? MISSING : anyAcc();
      const perAccount = new Map<string, number>();
      if (g) for (const c of M.contributions) if (c.goalId === goalId) perAccount.set(c.accountId, (perAccount.get(c.accountId) ?? 0) + c.amount);
      const archivedSources = [...perAccount.keys()].filter((a) => M.accounts.get(a)?.archived);
      let expected: DomainErrorCode | null = null;
      if (!g) expected = 'NOT_FOUND';
      else if (g.status !== 'ACTIVE') expected = 'GOAL_NOT_ACTIVE';
      else if (archivedSources.length > 0) {
        const da = dest ? M.accounts.get(dest) : undefined;
        if (!dest || !da || da.archived) expected = 'REFUND_ACCOUNT_REQUIRED';
      }
      return exec('goals.remove', () => A.goals.remove(goalId, dest ? { refundAccountId: dest } : {}), expected, () => {
        M.contributions = M.contributions.filter((c) => c.goalId !== goalId);
        M.adjustments = M.adjustments.filter((x) => !(x.kind === 'GOAL' && x.id === goalId));
        M.goals.delete(goalId);
        if (archivedSources.length > 0 && dest) {
          let total = 0;
          for (const source of archivedSources) {
            const amount = perAccount.get(source) ?? 0;
            total += amount;
            // El ARCHIVE_CLOSE deja el disponible de la archivada como estaba antes de borrar los aportes.
            M.adjustments.push({ kind: 'ACCOUNT', id: source, delta: -amount });
          }
          M.adjustments.push({ kind: 'ACCOUNT', id: dest, delta: total });
        }
      });
    }
    return undefined;
  }

  function debtOps(r: number): string | null | undefined {
    if (r < 81) {
      const balance = pick([0, ri(1, 500000)]);
      const installment = chance(0.7) ? ri(1, 60000) : null;
      const dt = chance(0.7) ? dateInput() : null;
      const expected = dt?.bad ? 'VALIDATION' : null;
      return exec('debts.create', () => A.debts.create({ name: `D${++counter}`, balanceMinor: balance, installmentMinor: installment, rate: { known: 0.01 }, nextDueDate: dt ? dt.v : undefined }), expected, (res) => {
        const id = res.result.id;
        M.debts.set(id, { id, installment, archived: false });
        if (balance > 0) M.adjustments.push({ kind: 'DEBT', id, delta: balance });
        if (installment !== null && dt) {
          if (!res.result.recurringId) throw new Error('sin recurringId');
          createDebtRecurring(id, dt.v, res.result.recurringId);
        }
      });
    }
    if (r < 89) {
      const debtId = anyDebt();
      const db = M.debts.get(debtId);
      const acc = anyAcc();
      const a = M.accounts.get(acc);
      const type = pick(['INSTALLMENT', 'INSTALLMENT', 'EXTRA'] as const);
      const amount = chance(0.04) ? 0 : ri(1, 300000);
      const rec = db ? debtRecurring(debtId) : undefined;
      let occ: string | undefined;
      let occBad: 'YEAR' | 'FORMAT' | null = null;
      if (chance(0.55)) {
        const r2 = rng.next();
        if (r2 < 0.15) { occ = pick(BAD_YEAR); occBad = 'YEAR'; }
        else if (r2 < 0.2) { occ = pick(BAD_FORMAT); occBad = 'FORMAT'; }
        else if (rec?.anchor && r2 < 0.75) { // ocurrencia de la serie (mensual), a veces ya confirmada
          occ = addMonths(rec.anchor, ri(0, 6));
          const confirmed = [...M.confirmed(rec.id)];
          if (confirmed.length > 0 && chance(0.3)) occ = pick(confirmed);
        } else occ = addDays(M.today(), ri(-90, 90)); // casi siempre ajena a la serie
      }
      const balanceNow = db ? M.debtBalance(debtId) : 0;
      let expected: DomainErrorCode | null = null;
      if (!db) expected = 'NOT_FOUND';
      else if (db.archived) expected = 'DEBT_ARCHIVED';
      else if (amount <= 0) expected = 'VALIDATION';
      else if (!a) expected = 'NOT_FOUND';
      else if (a.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (balanceNow <= 0) expected = 'DEBT_SETTLED';
      let occurrence: string | null = null;
      if (!expected && type === 'INSTALLMENT' && rec) {
        if (occ !== undefined) {
          if (occBad) expected = 'VALIDATION';
          else if (rec.anchor === null || !inSeries(rec.anchor, rec.frequency, occ)) expected = 'OCCURRENCE_NOT_IN_SERIES';
          else occurrence = occ;
        } else occurrence = rec.next;
        if (!expected && occurrence !== null && M.confirmed(rec.id).has(occurrence)) expected = 'OCCURRENCE_ALREADY_CONFIRMED';
      }
      return exec('debts.registerPayment', () => A.debts.registerPayment({ debtId, accountId: acc, amountMinor: amount, type, occurrenceDate: occ }), expected, (res) => {
        const applied = Math.min(amount, Math.max(balanceNow, 0));
        const linked = type === 'INSTALLMENT' && !!rec && occurrence !== null;
        M.txs.push({ id: res.result.transactionId, accountId: acc, type: 'EXPENSE', amount, kind: 'DEBT_PAYMENT', passive: false, date: env.clock.now, debtId, principal: applied, recurringId: linked && rec ? rec.id : null, occurrence: linked ? occurrence : null });
        const label = type === 'INSTALLMENT' && rec
          ? `${linked ? ' ligado' : ' SIN ligar (recurrente sin next)'}${occ !== undefined ? ' con occurrenceDate' : ''}${rec.anchor === null ? ' (ancla NULL)' : ''}`
          : ' (sin recurrente/EXTRA)';
        bump(stats.coverage, `registerPayment ${type}${label}`);
        if (res.result.linkedToOccurrence !== linked) throw new Error(`linkedToOccurrence BD=${res.result.linkedToOccurrence} modelo=${linked}`);
        if (res.result.principalAppliedMinor !== applied) throw new Error('principalApplied');
        if (linked && rec && occurrence !== null && rec.anchor !== null && rec.next === occurrence) {
          const next = nextPending(rec.anchor, rec.frequency, M.confirmed(rec.id), addDays(occurrence, 1));
          if (next !== null) {
            rec.next = next;
            rec.snoozedUntil = null;
          }
        }
      });
    }
    if (r < 91) {
      const debtId = anyDebt();
      const db = M.debts.get(debtId);
      const kind = pick(['balance', 'date', 'date']);
      const rec = db ? debtRecurring(debtId) : undefined;
      if (!db) return exec('debts.update', () => A.debts.update(debtId, { balanceMinor: 1 }), 'NOT_FOUND', () => {});
      if (db.archived) return exec('debts.update', () => A.debts.update(debtId, { balanceMinor: 1 }), 'DEBT_ARCHIVED', () => {});
      if (kind === 'balance') {
        const v = chance(0.1) ? -1 : ri(0, 400000);
        return exec('debts.update', () => A.debts.update(debtId, { balanceMinor: v }), v < 0 ? 'VALIDATION' : null, () => {
          const current = M.debtBalance(debtId);
          if (v !== current) M.adjustments.push({ kind: 'DEBT', id: debtId, delta: v - current });
        });
      }
      const dt = dateInput();
      if (dt.bad) return exec('debts.update', () => A.debts.update(debtId, { nextDueDate: dt.v }), 'VALIDATION', () => {});
      if (rec) {
        return exec('debts.update', () => A.debts.update(debtId, { nextDueDate: dt.v }), null, () => {
          rec.anchor = dt.v;
          rec.snoozedUntil = null;
          rec.next = nextPending(dt.v, rec.frequency, M.confirmed(rec.id), dt.v) ?? dt.v;
        });
      }
      if (db.installment === null) return exec('debts.update', () => A.debts.update(debtId, { nextDueDate: dt.v }), 'VALIDATION', () => {});
      // Sin recurrente y con cuota: la actualizacion lo crea (su id lo desconoce el modelo: se lee de la BD).
      return exec('debts.update', () => A.debts.update(debtId, { nextDueDate: dt.v }), null, () => {
        const recurringId = A.debts.get(debtId)?.recurringId;
        if (!recurringId) throw new Error('no se creo el recurrente de la cuota');
        createDebtRecurring(debtId, dt.v, recurringId);
      });
    }
    if (r < 92) {
      const debtId = anyDebt();
      const db = M.debts.get(debtId);
      const expected = !db ? 'NOT_FOUND' : db.archived ? 'DEBT_ARCHIVED' : null;
      return exec('debts.remove', () => A.debts.remove(debtId), expected, (res) => {
        const rec = debtRecurring(debtId);
        if (rec) {
          for (const x of M.txs) if (x.recurringId === rec.id) x.recurringId = null;
          M.recurring.delete(rec.id);
        }
        const hasPayments = M.txs.some((x) => x.debtId === debtId);
        const debt = db as ModelDebt;
        if (!hasPayments) {
          M.adjustments = M.adjustments.filter((x) => !(x.kind === 'DEBT' && x.id === debtId));
          M.debts.delete(debtId);
          if (res.result.outcome !== 'DELETED') throw new Error('outcome');
        } else {
          debt.archived = true;
          if (res.result.outcome !== 'ARCHIVED') throw new Error('outcome');
        }
      });
    }
    if (r < 93) { // SQL: dejar el recurrente de una deuda sin fecha (ancla NULL, o solo nextDueDate NULL)
      const recs = [...M.recurring.values()].filter((x) => x.kind === 'DEBT');
      if (recs.length === 0) return null;
      const rec = pick(recs);
      const both = chance(0.5);
      stats.ops++;
      bump(stats.accepted, 'sql.nullDebtRecurringDate');
      env.sqlite
        .prepare(both ? 'update recurring_items set anchor_date = null, next_due_date = null where id = ?' : 'update recurring_items set next_due_date = null where id = ?')
        .run(rec.id);
      if (both) rec.anchor = null;
      rec.next = null;
      return compareAll();
    }
    return undefined;
  }

  function recurringOps(r: number): string | null | undefined {
    if (r < 96) {
      const type = pick(['INCOME', 'EXPENSE'] as const);
      const frequency = pick(FREQUENCIES);
      const passive = type === 'INCOME' && chance(0.3);
      const amount = ri(1, 90000);
      const dt = chance(0.85) ? dateInput(-150) : null;
      const foreignCategory = chance(0.06);
      const defaultAccountId = chance(0.2) ? anyAcc() : undefined;
      const a = defaultAccountId !== undefined ? M.accounts.get(defaultAccountId) : undefined;
      let expected: DomainErrorCode | null = null;
      if (foreignCategory) expected = 'NOT_FOUND';
      else if (defaultAccountId !== undefined && !a) expected = 'NOT_FOUND';
      else if (a?.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (dt?.bad) expected = 'VALIDATION';
      const input: CreateRecurringInput = {
        type, name: `R${++counter}`, amountMinor: amount, isPassive: passive, frequency, anchorDate: dt ? dt.v : null,
        categoryId: foreignCategory ? foreignId('category') : undefined, defaultAccountId,
      };
      return exec('recurring.create', () => A.recurring.create(input), expected, (res) => {
        const anchor = dt ? normalizeAnchor(dt.v, frequency) : null;
        M.recurring.set(res.result.id, { id: res.result.id, kind: 'STANDARD', type, amount, passive, frequency, anchor, next: anchor, snoozedUntil: null });
      });
    }
    if (r < 97) {
      const std = standardRecIds();
      const id = std.length > 0 && chance(0.95) ? pick(std) : unknownId('recurring');
      const rec = M.recurring.get(id);
      const input: UpdateRecurringInput = {};
      let bad: 'YEAR' | 'FORMAT' | null = null;
      let newAnchor: string | null | undefined;
      let newFrequency: Frequency = rec?.frequency ?? 'MONTHLY';
      if (chance(0.7)) {
        if (chance(0.1)) { newAnchor = null; input.anchorDate = null; }
        else { const dt = dateInput(-150); input.anchorDate = dt.v; bad = dt.bad; newAnchor = dt.v; }
      }
      if (chance(0.3)) { newFrequency = pick(FREQUENCIES); input.frequency = newFrequency; }
      const foreignCategory = chance(0.06);
      if (foreignCategory) input.categoryId = foreignId('category');
      if (chance(0.15)) input.defaultAccountId = anyAcc();
      const a = input.defaultAccountId ? M.accounts.get(input.defaultAccountId) : undefined;
      let expected: DomainErrorCode | null = null;
      if (!rec) expected = 'NOT_FOUND';
      else if (foreignCategory) expected = 'NOT_FOUND';
      else if (input.defaultAccountId && !a) expected = 'NOT_FOUND';
      else if (a?.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (bad) expected = 'VALIDATION';
      return exec('recurring.update', () => A.recurring.update(id, input), expected, () => {
        if (!rec) return;
        const changed = input.anchorDate !== undefined || newFrequency !== rec.frequency;
        if (!changed) return;
        const anchorIn = newAnchor !== undefined ? newAnchor : rec.anchor;
        const anchor = anchorIn === null ? null : normalizeAnchor(anchorIn, newFrequency);
        rec.frequency = newFrequency;
        rec.snoozedUntil = null;
        rec.anchor = anchor;
        rec.next = anchor === null ? null : nextPending(anchor, newFrequency, M.confirmed(rec.id), anchor);
      });
    }
    if (r < 98) {
      const std = standardRecIds();
      const id = std.length > 0 && chance(0.95) ? pick(std) : unknownId('recurring');
      const rec = M.recurring.get(id);
      return exec('recurring.remove', () => A.recurring.remove(id), !rec ? 'NOT_FOUND' : null, () => {
        for (const x of M.txs) if (x.recurringId === id) x.recurringId = null;
        M.recurring.delete(id);
      });
    }
    if (r < 99) { // confirmar (incluye cuotas de deuda, ocurrencias ajenas a la serie y cuentas ajenas)
      const id = recIds().length > 0 && chance(0.95) ? pick(recIds()) : unknownId('recurring');
      const rec = M.recurring.get(id);
      const useAcc = chance(0.95);
      const acc = anyAcc();
      const a = M.accounts.get(acc);
      let occ: string;
      let bad: 'YEAR' | 'FORMAT' | null = null;
      const r2 = rng.next();
      if (r2 < 0.1) { occ = pick(BAD_YEAR); bad = 'YEAR'; }
      else if (r2 < 0.14) { occ = pick(BAD_FORMAT); bad = 'FORMAT'; }
      else if (rec?.anchor && r2 < 0.75) {
        const candidates: string[] = [];
        let cur = normalizeAnchor(rec.anchor, rec.frequency);
        for (let i = 0; i < 12 && candidates.length < 6; i++, cur = addDays(cur, 1)) {
          if (inSeries(rec.anchor, rec.frequency, cur)) candidates.push(cur);
        }
        occ = rec.next && chance(0.5) ? rec.next : pick(candidates);
        const confirmed = [...M.confirmed(id)];
        if (confirmed.length > 0 && chance(0.3)) occ = pick(confirmed);
      } else occ = addDays(M.today(), ri(-60, 60));
      const amount = chance(0.1) ? ri(1, 5000) : undefined;
      let expected: DomainErrorCode | null = null;
      if (!rec) expected = 'NOT_FOUND';
      else if (rec.kind === 'DEBT') expected = 'USE_DEBT_PAYMENT_FLOW';
      else if (rec.anchor === null) expected = 'RECURRING_WITHOUT_DATE';
      else if (!useAcc) expected = 'ACCOUNT_REQUIRED';
      else if (bad) expected = 'VALIDATION';
      else if (!inSeries(rec.anchor, rec.frequency, occ)) expected = 'OCCURRENCE_NOT_IN_SERIES';
      else if (!a) expected = 'NOT_FOUND';
      else if (a.archived) expected = 'ACCOUNT_ARCHIVED';
      else if (M.confirmed(id).has(occ)) expected = 'OCCURRENCE_ALREADY_CONFIRMED';
      return exec('recurring.confirmOccurrence', () => A.recurring.confirmOccurrence({ recurringId: id, occurrenceDate: occ, accountId: useAcc ? acc : '', amountMinor: amount }), expected, (res) => {
        if (!rec) return;
        M.txs.push({ id: res.result.transactionId, accountId: acc, type: rec.type, amount: amount ?? rec.amount, kind: 'STANDARD', passive: rec.passive, date: env.clock.now, recurringId: id, occurrence: occ });
        if (rec.next === occ && rec.anchor !== null) {
          const next = nextPending(rec.anchor, rec.frequency, M.confirmed(id), addDays(occ, 1));
          if (next !== null) {
            rec.next = next;
            rec.snoozedUntil = null;
          }
        }
      });
    }
    return undefined;
  }

  function unconfirmOp(): string | null {
    const linked = M.txs.filter((x) => x.recurringId !== null && x.occurrence !== null);
    const target = linked.length > 0 && chance(0.9) ? pick(linked) : undefined;
    let recurringId = target?.recurringId ?? 'x';
    let occurrence = target?.occurrence ?? '2026-01-01';
    if (!target && chance(0.5)) { // ocurrencia confirmada de OTRO usuario
      [recurringId, occurrence] = pick([[fRec, fRecOccurrence], [fDebt.recurringId ?? '', fDebtOccurrence]] as const);
      foreignUsed = 'recurring';
    }
    const expected = !target ? 'NOT_FOUND' : M.accounts.get(target.accountId)?.archived ? 'ACCOUNT_ARCHIVED' : null;
    return exec('recurring.unconfirm', () => A.recurring.unconfirm(recurringId, occurrence), expected, () => {
      if (target) M.removeTx(target);
    });
  }

  /** "Todavia no": el aviso se pospone al dia siguiente a la hora de recordatorio (9 por defecto). */
  function snoozeOp(): string | null {
    const id = recIds().length > 0 && chance(0.9) ? pick(recIds()) : unknownId('recurring');
    const rec = M.recurring.get(id);
    return exec('recurring.snooze', () => A.recurring.snooze(id), rec ? null : 'NOT_FOUND', (res) => {
      if (!rec) return;
      rec.snoozedUntil = midnightMs(addDays(M.today(), 1)) + M.reminderHour * H;
      if (res.result.snoozedUntil !== rec.snoozedUntil) throw new Error(`snoozedUntil BD=${res.result.snoozedUntil} modelo=${rec.snoozedUntil}`);
    });
  }

  /** Hora del recordatorio (afecta al siguiente snooze). Fuera de 0-23 o no entera: VALIDATION. */
  function reminderHourOp(): string | null {
    const hour = chance(0.2) ? pick([-1, 24, 9.5]) : ri(0, 23);
    const valid = Number.isInteger(hour) && hour >= 0 && hour <= 23;
    return exec('settings.setNotifications', () => A.settings.setNotifications({ reminderHour: hour }), valid ? null : 'VALIDATION', () => {
      M.reminderHour = hour;
    });
  }

  function clockOp(): string | null {
    stats.ops++;
    env.clock.now += ri(0, 45) * DAY + ri(0, 5) * H;
    bump(stats.accepted, 'clock.advance');
    return compareAll();
  }

  /** Cola de la distribucion: desmarcar, posponer, cambiar la hora del aviso o avanzar el reloj. */
  function tailOp(): string | null {
    const roll = rng.next();
    if (roll < 0.35) return unconfirmOp();
    if (roll < 0.6) return snoozeOp();
    if (roll < 0.67) return reminderHourOp();
    return clockOp();
  }

  /**
   * El OTRO usuario opera con ids del principal (todas las clases, y ids propios mezclados con ajenos):
   * debe fallar con NOT_FOUND sin tocar la BD; las lecturas deben devolver lo mismo que para un id inexistente.
   */
  function actAsOtherUser(): string | null {
    const kind = pick(['account', 'transaction', 'transfer', 'debt', 'goal', 'recurring', 'category'] as const);
    const fOccurrence = addMonths(fRecOccurrence, 1);
    const widgets = { cashflow: true, debts: true, goals: true };
    const recurringInput = { type: 'EXPENSE', name: 'N', amountMinor: 10, frequency: 'MONTHLY' } as const;
    if (kind === 'account') {
      if (accIds().length === 0) return null;
      const id = pick(accIds());
      return pick<() => string | null>([
        () => mustNotFound('accounts.update', () => B.accounts.update(id, { name: 'X' })),
        () => mustNotFound('accounts.update(saldo)', () => B.accounts.update(id, { balanceMinor: 1 })),
        () => mustNotFound('accounts.remove', () => B.accounts.remove(id)),
        () => mustNotFound('accounts.unarchive', () => B.accounts.unarchive(id)),
        () => mustReadEmpty('accounts.get', () => B.accounts.get(id) ?? null, null),
        () => mustNotFound('transactions.create', () => B.transactions.create({ type: 'INCOME', accountId: id, amountMinor: 5 })),
        () => mustNotFound('transfers.create(origen)', () => B.transfers.create({ fromAccountId: id, toAccountId: fAcc, amountMinor: 1 })),
        () => mustNotFound('transfers.create(destino)', () => B.transfers.create({ fromAccountId: fAcc, toAccountId: id, amountMinor: 1 })),
        () => mustNotFound('transactions.update(cuenta)', () => B.transactions.update(fTx, { accountId: id })),
        () => mustNotFound('transfers.update(cuenta)', () => B.transfers.update(fXfer, { toAccountId: id })),
        () => mustNotFound('debts.registerPayment(cuenta)', () => B.debts.registerPayment({ debtId: fDebt.id, accountId: id, amountMinor: 5, type: 'EXTRA' })),
        () => mustNotFound('goals.contribute(cuenta)', () => B.goals.contribute({ goalId: fGoal, accountId: id, amountMinor: 1 })),
        () => mustNotFound('goals.create(cuenta)', () => B.goals.create({ name: 'N', targetMinor: 9_000, initialMinor: 1, accountId: id })),
        () => mustNotFound('recurring.confirmOccurrence(cuenta)', () => B.recurring.confirmOccurrence({ recurringId: fRec, occurrenceDate: fOccurrence, accountId: id })),
        () => mustNotFound('recurring.create(cuenta)', () => B.recurring.create({ ...recurringInput, defaultAccountId: id })),
        () => mustNotFound('recurring.update(cuenta)', () => B.recurring.update(fRec, { defaultAccountId: id })),
        () => mustNotFound('onboarding.complete(cuenta)', () => B.onboarding.complete({ accounts: [], recurring: [{ ...recurringInput, defaultAccountId: id }], widgets })),
      ])();
    }
    if (kind === 'transaction') {
      if (M.txs.length === 0) return null;
      const id = pick(M.txs).id;
      return pick<() => string | null>([
        () => mustNotFound('transactions.remove', () => B.transactions.remove(id)),
        () => mustNotFound('transactions.update', () => B.transactions.update(id, { amountMinor: 1 })),
        () => mustReadEmpty('transactions.get', () => B.transactions.get(id) ?? null, null),
      ])();
    }
    if (kind === 'transfer') {
      if (M.transfers.length === 0) return null;
      const id = pick(M.transfers).id;
      return pick<() => string | null>([
        () => mustNotFound('transfers.update', () => B.transfers.update(id, { amountMinor: 1 })),
        () => mustNotFound('transfers.remove', () => B.transfers.remove(id)),
        () => mustReadEmpty('transfers.get', () => B.transfers.get(id) ?? null, null),
        () => mustReadEmpty('activity.list(cuenta)', () => B.activity.list({ accountId: M.transfers[0].from }), []),
      ])();
    }
    if (kind === 'debt') {
      if (debtIds().length === 0) return null;
      const id = pick(debtIds());
      return pick<() => string | null>([
        () => mustNotFound('debts.update', () => B.debts.update(id, { name: 'X', balanceMinor: 1 })),
        () => mustNotFound('debts.update(fecha)', () => B.debts.update(id, { nextDueDate: addDays(M.today(), 3) })),
        () => mustNotFound('debts.remove', () => B.debts.remove(id)),
        () => mustNotFound('debts.registerPayment', () => B.debts.registerPayment({ debtId: id, accountId: fAcc, amountMinor: 5, type: 'EXTRA' })),
        () => mustReadEmpty('debts.get', () => B.debts.get(id) ?? null, null),
        () => mustReadEmpty('debts.payments', () => B.debts.payments(id), []),
      ])();
    }
    if (kind === 'goal') {
      if (goalIds().length === 0) return null;
      const id = pick(goalIds());
      return pick<() => string | null>([
        () => mustNotFound('goals.contribute', () => B.goals.contribute({ goalId: id, accountId: fAcc, amountMinor: 1 })),
        () => mustNotFound('goals.update', () => B.goals.update(id, { name: 'X', savedMinor: 1 })),
        () => mustNotFound('goals.close', () => B.goals.close(id)),
        () => mustNotFound('goals.remove', () => B.goals.remove(id, { refundAccountId: fAcc })),
        () => mustReadEmpty('goals.get', () => B.goals.get(id) ?? null, null),
        () => mustReadEmpty('goals.contributions', () => B.goals.contributions(id), []),
        () => mustReadEmpty('goals.refundPreview', () => B.goals.refundPreview(id), { refunds: [], requiresDestinationMinor: 0 }),
      ])();
    }
    if (kind === 'recurring') {
      if (recIds().length === 0) return null;
      const id = pick(recIds());
      const linked = M.txs.filter((x) => x.recurringId !== null && x.occurrence !== null);
      return pick<() => string | null>([
        () => mustNotFound('recurring.update', () => B.recurring.update(id, { name: 'X' })),
        () => mustNotFound('recurring.remove', () => B.recurring.remove(id)),
        () => mustNotFound('recurring.snooze', () => B.recurring.snooze(id)),
        () => mustNotFound('recurring.confirmOccurrence', () => B.recurring.confirmOccurrence({ recurringId: id, occurrenceDate: M.recurring.get(id)?.next ?? '2026-01-01', accountId: fAcc })),
        () => {
          if (linked.length === 0) return null;
          const t = pick(linked);
          return mustNotFound('recurring.unconfirm', () => B.recurring.unconfirm(t.recurringId ?? '', t.occurrence ?? ''));
        },
      ])();
    }
    // category: las categorias propias del principal
    const cats = [...ownCategories.values()];
    if (cats.length === 0) return null;
    const id = pick(cats);
    return pick<() => string | null>([
      () => mustNotFound('transactions.create(categoria)', () => B.transactions.create({ type: 'EXPENSE', accountId: fAcc, amountMinor: 5, categoryId: id })),
      () => mustNotFound('recurring.create(categoria)', () => B.recurring.create({ ...recurringInput, categoryId: id })),
      () => mustNotFound('recurring.update(categoria)', () => B.recurring.update(fRec, { categoryId: id })),
      () => mustNotFound('onboarding.complete(categoria)', () => B.onboarding.complete({ accounts: [], recurring: [{ ...recurringInput, categoryId: id }], widgets })),
    ])();
  }

  function randomOp(): string | null {
    if (chance(0.07)) return actAsOtherUser();
    // Los recurrentes tienen ramas estrechas en el reparto base: se refuerzan para ejercitarlos en secuencias cortas.
    if (chance(0.05)) return goalOps(70) ?? null;
    if (chance(0.1)) return transferOps();
    if (chance(0.12)) {
      const focus = pick([95, 96, 96, 97, 98, 98, 98, 99, 99]);
      return focus === 99 ? (chance(0.5) ? unconfirmOp() : snoozeOp()) : (recurringOps(focus) ?? null);
    }
    const r = chance(0.06) ? 98 : chance(0.03) ? 99 : ri(0, 99);
    const handlers = [accountOps, transactionOps, goalOps, debtOps, recurringOps];
    for (const handler of handlers) {
      const result = handler(r);
      if (result !== undefined) return result;
    }
    return tailOp();
  }

  let divergence: string | null = null;
  let executed = 0;
  for (let i = 0; i < nOps && divergence === null; i++) {
    executed = i + 1;
    try {
      divergence = randomOp();
    } catch (e) {
      divergence = `EXCEPCION DEL HARNESS/MODELO: ${(e as Error).message}`;
    }
  }
  if (divergence === null && viewsOfOther() !== baselineViews) divergence = 'las vistas del otro usuario cambiaron';
  env.sqlite.close();
  return { divergence, executed, log };
}
