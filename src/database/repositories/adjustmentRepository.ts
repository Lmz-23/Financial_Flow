import { and, asc, eq, sql } from 'drizzle-orm';
import { newId } from '../ids';
import { balanceAdjustments, type BalanceAdjustment } from '../schema';
import type { DbOrTx } from '../types';
import { mapRows, toDate, type DatesToMs } from './mapping';

export type AdjustmentRow = DatesToMs<BalanceAdjustment>;
export type AdjustmentReason = BalanceAdjustment['reason'];

export type AdjustmentTarget =
  | { type: 'ACCOUNT'; id: string }
  | { type: 'DEBT'; id: string }
  | { type: 'GOAL'; id: string };

function targetWhere(target: AdjustmentTarget) {
  switch (target.type) {
    case 'ACCOUNT':
      return eq(balanceAdjustments.accountId, target.id);
    case 'DEBT':
      return eq(balanceAdjustments.debtId, target.id);
    case 'GOAL':
      return eq(balanceAdjustments.goalId, target.id);
  }
}

export interface InsertAdjustment {
  userId: string;
  target: AdjustmentTarget;
  previousMinor: number;
  newMinor: number;
  reason: AdjustmentReason;
  now: number;
}

export const adjustmentRepository = {
  /** deltaMinor se calcula aqui (nuevo - anterior); el CHECK de la BD lo vuelve a exigir. */
  insert(db: DbOrTx, v: InsertAdjustment): string {
    const id = newId();
    db.insert(balanceAdjustments)
      .values({
        id,
        userId: v.userId,
        targetType: v.target.type,
        accountId: v.target.type === 'ACCOUNT' ? v.target.id : null,
        debtId: v.target.type === 'DEBT' ? v.target.id : null,
        goalId: v.target.type === 'GOAL' ? v.target.id : null,
        previousMinor: v.previousMinor,
        newMinor: v.newMinor,
        deltaMinor: v.newMinor - v.previousMinor,
        reason: v.reason,
        createdAt: toDate(v.now),
      })
      .run();
    return id;
  },

  /** Suma de deltas de los ajustes del objetivo. */
  sumDelta(db: DbOrTx, target: AdjustmentTarget): number {
    const row = db
      .select({ total: sql<number>`coalesce(sum(${balanceAdjustments.deltaMinor}), 0)`.mapWith(Number) })
      .from(balanceAdjustments)
      .where(targetWhere(target))
      .get();
    return row?.total ?? 0;
  },

  listFor(db: DbOrTx, target: AdjustmentTarget): AdjustmentRow[] {
    return mapRows(
      db
        .select()
        .from(balanceAdjustments)
        .where(targetWhere(target))
        .orderBy(asc(balanceAdjustments.createdAt))
        .all(),
    );
  },

  deleteFor(db: DbOrTx, target: AdjustmentTarget): void {
    db.delete(balanceAdjustments).where(targetWhere(target)).run();
  },

  countFor(db: DbOrTx, target: AdjustmentTarget, reason?: AdjustmentReason): number {
    const where = reason
      ? and(targetWhere(target), eq(balanceAdjustments.reason, reason))
      : targetWhere(target);
    const row = db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(balanceAdjustments)
      .where(where)
      .get();
    return row?.n ?? 0;
  },
};
