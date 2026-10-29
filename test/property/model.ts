// Modelo de referencia INDEPENDIENTE del dominio: libro mayor propio (ajustes, transacciones, aportes),
// calendario propio y ETA propio (BigInt). No importa nada de src/domain/rules; predice el estado que
// deberian mostrar los servicios tras cada operacion aceptada.
import { addMonths, dim, inSeries, localDateOf, monthStartMs, parts, shiftMonth, type Frequency } from './calendar';

export interface Adjustment { kind: 'ACCOUNT' | 'GOAL' | 'DEBT'; id: string; delta: number }

export interface ModelTx {
  id: string;
  accountId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  kind: 'STANDARD' | 'DEBT_PAYMENT';
  passive: boolean;
  date: number;
  debtId?: string;
  /** Capital aplicado a la deuda (solo pagos de deuda). */
  principal?: number;
  recurringId: string | null;
  occurrence: string | null;
}

export interface ModelTransfer { id: string; from: string; to: string; amount: number; date: number }

export interface ModelContribution { goalId: string; accountId: string; amount: number; date: number }

export interface ModelGoal {
  id: string;
  target: number;
  targetDate: string | null;
  status: 'ACTIVE' | 'SPENT';
  spent: number;
  spentAt: number;
}

export interface ModelDebt { id: string; installment: number | null; archived: boolean }

export interface ModelRecurring {
  id: string;
  kind: 'STANDARD' | 'DEBT';
  debtId?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  passive: boolean;
  frequency: Frequency;
  anchor: string | null;
  next: string | null;
  /** Epoch ms hasta el que se pospuso el aviso ("todavia no"), o null. */
  snoozedUntil: number | null;
}

/** Prediccion del ETA con las claves en el mismo orden que devuelve el dominio (se compara por JSON). */
export type EtaPrediction = Record<string, unknown> | null;

export class Model {
  /** Cuentas desarchivadas alguna vez (solo para cobertura). */
  readonly unarchived = new Set<string>();
  readonly accounts = new Map<string, { archived: boolean }>();
  adjustments: Adjustment[] = [];
  txs: ModelTx[] = [];
  contributions: ModelContribution[] = [];
  transfers: ModelTransfer[] = [];
  readonly goals = new Map<string, ModelGoal>();
  readonly debts = new Map<string, ModelDebt>();
  readonly recurring = new Map<string, ModelRecurring>();
  /** Hora local del recordatorio (por defecto 9). */
  reminderHour = 9;

  /** `clock` es el MISMO objeto que lee el dominio inyectado: moverlo mueve el "ahora" de ambos. */
  constructor(readonly clock: { now: number }) {}

  today(): string {
    return localDateOf(this.clock.now);
  }

  available(accountId: string): number {
    let v = 0;
    for (const x of this.adjustments) if (x.kind === 'ACCOUNT' && x.id === accountId) v += x.delta;
    for (const t of this.txs) if (t.accountId === accountId) v += t.type === 'INCOME' ? t.amount : -t.amount;
    for (const c of this.contributions) if (c.accountId === accountId) v -= c.amount;
    for (const t of this.transfers) {
      if (t.from === accountId) v -= t.amount;
      if (t.to === accountId) v += t.amount;
    }
    return v;
  }

  saved(goalId: string): number {
    let v = 0;
    for (const x of this.adjustments) if (x.kind === 'GOAL' && x.id === goalId) v += x.delta;
    for (const c of this.contributions) if (c.goalId === goalId) v += c.amount;
    return v;
  }

  debtBalance(debtId: string): number {
    let v = 0;
    for (const x of this.adjustments) if (x.kind === 'DEBT' && x.id === debtId) v += x.delta;
    for (const t of this.txs) if (t.debtId === debtId) v -= t.principal ?? 0;
    return v;
  }

  confirmed(recurringId: string): Set<string> {
    return new Set(this.txs.filter((t) => t.recurringId === recurringId && t.occurrence !== null).map((t) => t.occurrence as string));
  }

  /** ETA esperado y una etiqueta de cobertura (que rama del ETA se ejercito). */
  eta(g: ModelGoal): { value: EtaPrediction; tag: string } {
    if (g.status === 'SPENT') return { value: null, tag: 'SPENT' };
    const missing = g.target - this.saved(g.id);
    if (missing <= 0) return { value: { kind: 'REACHED' }, tag: 'REACHED' };
    const today = this.today();
    if (g.targetDate !== null) {
      if (g.targetDate < today) {
        return {
          value: { kind: 'BY_TARGET_DATE', date: g.targetDate, overdue: true, monthsLeft: 0, requiredMonthlyMinor: missing },
          tag: 'BY_TARGET_DATE vencida',
        };
      }
      // Meses enteros (con el dia de hoy recortado) hasta alcanzar la fecha objetivo; minimo 1.
      const [ty, tm, td] = parts(g.targetDate);
      const targetKey = ty * 10000 + tm * 100 + td;
      const [y0, m0, d0] = parts(today);
      let k = 1;
      for (;; k++) {
        const [ny, nm] = shiftMonth(y0, m0, k);
        if (ny * 10000 + nm * 100 + Math.min(d0, dim(ny, nm)) >= targetKey) break;
      }
      return {
        value: {
          kind: 'BY_TARGET_DATE',
          date: g.targetDate,
          overdue: false,
          monthsLeft: k,
          requiredMonthlyMinor: Number((BigInt(missing) + BigInt(k) - 1n) / BigInt(k)),
        },
        tag: 'BY_TARGET_DATE',
      };
    }
    // Ritmo: aportes de los 3 meses calendario que terminan en el actual (hasta "ahora"), entre 3.
    const [y, m] = parts(today);
    const [wy, wm] = shiftMonth(y, m, -2);
    const windowStart = monthStartMs(wy, wm);
    let total = 0;
    for (const c of this.contributions) {
      if (c.goalId === g.id && c.date >= windowStart && c.date <= this.clock.now) total += c.amount;
    }
    if (total <= 0) return { value: { kind: 'UNKNOWN' }, tag: 'UNKNOWN sin aportes en ventana' };
    const monthsLeft = (3n * BigInt(missing) + BigInt(total) - 1n) / BigInt(total);
    if (monthsLeft > 1200n) {
      return { value: { kind: 'UNKNOWN' }, tag: monthsLeft <= 1210n ? 'UNKNOWN tope (1201..1210 meses)' : 'UNKNOWN tope (>1210 meses)' };
    }
    const tag = monthsLeft === 1200n ? 'BY_PACE exactamente 1200' : monthsLeft >= 1190n ? 'BY_PACE 1190..1199' : 'BY_PACE';
    return {
      value: {
        kind: 'BY_PACE',
        date: addMonths(today, Number(monthsLeft)),
        monthsLeft: Number(monthsLeft),
        monthlyAverageMinor: Number((2n * BigInt(total) + 3n) / 6n),
      },
      tag,
    };
  }

  /** Estado financiero del mes (month 1-12) con el orden de claves del dominio. */
  statement(y: number, m: number) {
    const start = monthStartMs(y, m);
    const [ny, nm] = shiftMonth(y, m, 1);
    const end = monthStartMs(ny, nm);
    let income = 0, passive = 0, life = 0, debt = 0, goals = 0;
    for (const t of this.txs) {
      if (t.date < start || t.date >= end) continue;
      if (t.type === 'INCOME') {
        income += t.amount;
        if (t.passive) passive += t.amount;
      } else if (t.kind === 'STANDARD') life += t.amount;
      else debt += t.amount;
    }
    for (const g of this.goals.values()) {
      if (g.status === 'SPENT' && g.spentAt >= start && g.spentAt < end) goals += g.spent;
    }
    const total = life + debt + goals;
    return {
      ingresoTotal: income,
      ingresoPasivo: passive,
      ingresoActivo: income - passive,
      gastoVida: life,
      gastoDeuda: debt,
      gastoMetas: goals,
      gastoTotal: total,
      netCashflow: income - total,
      index: total > 0 ? { kind: 'RATIO', ratio: passive / total } : passive > 0 ? { kind: 'NO_EXPENSES' } : { kind: 'NONE' },
    };
  }

  netWorth(): number {
    let v = 0;
    for (const [id, a] of this.accounts) if (!a.archived) v += this.available(id);
    for (const g of this.goals.values()) if (g.status === 'ACTIVE') v += this.saved(g.id);
    for (const d of this.debts.values()) if (!d.archived) v -= this.debtBalance(d.id);
    return v;
  }

  /** Quita una transaccion y, si estaba ligada a la serie de un recurrente con fecha, reubica su proxima fecha. */
  removeTx(tx: ModelTx): void {
    this.txs = this.txs.filter((x) => x !== tx);
    if (tx.recurringId === null || tx.occurrence === null) return;
    const rec = this.recurring.get(tx.recurringId);
    if (rec && rec.anchor !== null && inSeries(rec.anchor, rec.frequency, tx.occurrence)) {
      rec.next = rec.next === null || tx.occurrence < rec.next ? tx.occurrence : rec.next;
      rec.snoozedUntil = null;
    }
  }
}
