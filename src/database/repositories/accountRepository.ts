import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { newId } from '../ids';
import {
  accounts,
  balanceAdjustments,
  goalContributions,
  transactions,
  type Account,
} from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type AccountRow = DatesToMs<Account>;
export type AccountType = Account['type'];

const num = <T>(expr: ReturnType<typeof sql<T>>) => expr.mapWith(Number);

export const accountRepository = {
  insert(
    db: DbOrTx,
    v: { userId: string; name: string; type: AccountType; order: number; now: number },
  ): string {
    const id = newId();
    db.insert(accounts)
      .values({
        id,
        userId: v.userId,
        name: v.name,
        type: v.type,
        order: v.order,
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  getById(db: DbOrTx, id: string): AccountRow | undefined {
    const row = db.select().from(accounts).where(eq(accounts.id, id)).get();
    return row ? mapRow(row) : undefined;
  },

  /** Cuentas no archivadas, en orden de usuario. */
  listActive(db: DbOrTx, userId: string): AccountRow[] {
    return mapRows(
      db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
        .orderBy(asc(accounts.order), asc(accounts.createdAt))
        .all(),
    );
  },

  /** Todas, incluidas las archivadas (para invariantes y reportes). */
  listAll(db: DbOrTx, userId: string): AccountRow[] {
    return mapRows(
      db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .orderBy(asc(accounts.order), asc(accounts.createdAt))
        .all(),
    );
  },

  maxOrder(db: DbOrTx, userId: string): number {
    const row = db
      .select({ m: num(sql<number>`coalesce(max(${accounts.order}), -1)`) })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .get();
    return row?.m ?? -1;
  },

  rename(db: DbOrTx, id: string, name: string, now: number): void {
    db.update(accounts).set({ name, updatedAt: toDate(now) }).where(eq(accounts.id, id)).run();
  },

  archive(db: DbOrTx, id: string, now: number): void {
    db.update(accounts)
      .set({ archivedAt: toDate(now), updatedAt: toDate(now) })
      .where(eq(accounts.id, id))
      .run();
  },

  delete(db: DbOrTx, id: string): void {
    db.delete(accounts).where(eq(accounts.id, id)).run();
  },

  /** true si la cuenta tiene transacciones o aportes a metas. */
  hasMovements(db: DbOrTx, id: string): boolean {
    const tx = db
      .select({ n: num(sql<number>`count(*)`) })
      .from(transactions)
      .where(eq(transactions.accountId, id))
      .get();
    if ((tx?.n ?? 0) > 0) return true;
    const gc = db
      .select({ n: num(sql<number>`count(*)`) })
      .from(goalContributions)
      .where(eq(goalContributions.accountId, id))
      .get();
    return (gc?.n ?? 0) > 0;
  },

  /**
   * Disponible derivado (§3.1):
   * Σ ajustes + Σ ingresos − Σ gastos − Σ aportes desde la cuenta.
   */
  availableOf(db: DbOrTx, id: string): number {
    const adj = db
      .select({ v: num(sql<number>`coalesce(sum(${balanceAdjustments.deltaMinor}), 0)`) })
      .from(balanceAdjustments)
      .where(eq(balanceAdjustments.accountId, id))
      .get();
    const tx = db
      .select({
        income: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else 0 end), 0)`),
        expense: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' then ${transactions.amountMinor} else 0 end), 0)`),
      })
      .from(transactions)
      .where(eq(transactions.accountId, id))
      .get();
    const gc = db
      .select({ v: num(sql<number>`coalesce(sum(${goalContributions.amountMinor}), 0)`) })
      .from(goalContributions)
      .where(eq(goalContributions.accountId, id))
      .get();
    return (adj?.v ?? 0) + (tx?.income ?? 0) - (tx?.expense ?? 0) - (gc?.v ?? 0);
  },

  /** Disponible de todas las cuentas del usuario (incluidas archivadas), por id. */
  availableByAccount(db: DbOrTx, userId: string): Map<string, number> {
    const result = new Map<string, number>();
    for (const a of db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)).all()) {
      result.set(a.id, 0);
    }
    const add = (accountId: string | null, delta: number): void => {
      if (accountId === null) return;
      result.set(accountId, (result.get(accountId) ?? 0) + delta);
    };

    for (const r of db
      .select({
        accountId: balanceAdjustments.accountId,
        v: num(sql<number>`coalesce(sum(${balanceAdjustments.deltaMinor}), 0)`),
      })
      .from(balanceAdjustments)
      .where(and(eq(balanceAdjustments.userId, userId), eq(balanceAdjustments.targetType, 'ACCOUNT')))
      .groupBy(balanceAdjustments.accountId)
      .all()) {
      add(r.accountId, r.v);
    }
    for (const r of db
      .select({
        accountId: transactions.accountId,
        income: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else 0 end), 0)`),
        expense: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' then ${transactions.amountMinor} else 0 end), 0)`),
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(transactions.accountId)
      .all()) {
      add(r.accountId, r.income - r.expense);
    }
    for (const r of db
      .select({
        accountId: goalContributions.accountId,
        v: num(sql<number>`coalesce(sum(${goalContributions.amountMinor}), 0)`),
      })
      .from(goalContributions)
      .where(eq(goalContributions.userId, userId))
      .groupBy(goalContributions.accountId)
      .all()) {
      add(r.accountId, -r.v);
    }
    return result;
  },
};
