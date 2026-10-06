import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { newId } from '../ids';
import { recurringItems, type RecurringItem } from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type RecurringRow = DatesToMs<RecurringItem>;
export type RecurringFrequency = RecurringItem['frequency'];

export interface InsertRecurring {
  userId: string;
  type: RecurringItem['type'];
  kind: RecurringItem['kind'];
  debtId?: string | null;
  name: string | null;
  amountMinor: number | null;
  isPassive?: boolean;
  categoryId?: string | null;
  defaultAccountId?: string | null;
  frequency: RecurringFrequency;
  anchorDate: string | null;
  nextDueDate: string | null;
  now: number;
}

/** Cada campo `undefined` se deja intacto; `null` limpia el campo (si la columna lo admite). */
export interface UpdateRecurring {
  name?: string | null;
  amountMinor?: number | null;
  isPassive?: boolean;
  categoryId?: string | null;
  defaultAccountId?: string | null;
  frequency?: RecurringFrequency;
  anchorDate?: string | null;
  nextDueDate?: string | null;
  /** Epoch ms o null. */
  snoozedUntil?: number | null;
  now: number;
}

export const recurringRepository = {
  insert(db: DbOrTx, v: InsertRecurring): string {
    const id = newId();
    db.insert(recurringItems)
      .values({
        id,
        userId: v.userId,
        type: v.type,
        kind: v.kind,
        debtId: v.debtId ?? null,
        name: v.name,
        amountMinor: v.amountMinor,
        isPassive: v.isPassive ?? false,
        categoryId: v.categoryId ?? null,
        defaultAccountId: v.defaultAccountId ?? null,
        frequency: v.frequency,
        anchorDate: v.anchorDate,
        nextDueDate: v.nextDueDate,
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  getById(db: DbOrTx, id: string): RecurringRow | undefined {
    const row = db.select().from(recurringItems).where(eq(recurringItems.id, id)).get();
    return row ? mapRow(row) : undefined;
  },

  getByDebtId(db: DbOrTx, debtId: string): RecurringRow | undefined {
    const row = db.select().from(recurringItems).where(eq(recurringItems.debtId, debtId)).get();
    return row ? mapRow(row) : undefined;
  },

  /** Recurrentes STANDARD del usuario (la gestion de cuotas de deuda es de DebtService). */
  listStandard(db: DbOrTx, userId: string): RecurringRow[] {
    return mapRows(
      db
        .select()
        .from(recurringItems)
        .where(and(eq(recurringItems.userId, userId), eq(recurringItems.kind, 'STANDARD')))
        .orderBy(asc(recurringItems.createdAt))
        .all(),
    );
  },

  /** Recurrentes activos con fecha (STANDARD y cuotas de deuda). */
  listActiveDated(db: DbOrTx, userId: string): RecurringRow[] {
    return mapRows(
      db
        .select()
        .from(recurringItems)
        .where(
          and(
            eq(recurringItems.userId, userId),
            eq(recurringItems.status, 'ACTIVE'),
            isNotNull(recurringItems.nextDueDate),
          ),
        )
        .orderBy(asc(recurringItems.nextDueDate), asc(recurringItems.createdAt))
        .all(),
    );
  },

  update(db: DbOrTx, id: string, v: UpdateRecurring): void {
    const set: Partial<typeof recurringItems.$inferInsert> = { updatedAt: toDate(v.now) };
    if (v.name !== undefined) set.name = v.name;
    if (v.amountMinor !== undefined) set.amountMinor = v.amountMinor;
    if (v.isPassive !== undefined) set.isPassive = v.isPassive;
    if (v.categoryId !== undefined) set.categoryId = v.categoryId;
    if (v.defaultAccountId !== undefined) set.defaultAccountId = v.defaultAccountId;
    if (v.frequency !== undefined) set.frequency = v.frequency;
    if (v.anchorDate !== undefined) set.anchorDate = v.anchorDate;
    if (v.nextDueDate !== undefined) set.nextDueDate = v.nextDueDate;
    if (v.snoozedUntil !== undefined) set.snoozedUntil = v.snoozedUntil === null ? null : toDate(v.snoozedUntil);
    db.update(recurringItems).set(set).where(eq(recurringItems.id, id)).run();
  },

  delete(db: DbOrTx, id: string): void {
    db.delete(recurringItems).where(eq(recurringItems.id, id)).run();
  },

  /** Los recurrentes que tenian la cuenta como predeterminada quedan sin cuenta. */
  clearDefaultAccount(db: DbOrTx, accountId: string, now: number): void {
    db.update(recurringItems)
      .set({ defaultAccountId: null, updatedAt: toDate(now) })
      .where(eq(recurringItems.defaultAccountId, accountId))
      .run();
  },
};
