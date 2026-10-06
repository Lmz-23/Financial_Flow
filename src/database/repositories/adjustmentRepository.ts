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

/** Ajustes del objetivo QUE ademas pertenecen al usuario (toda consulta por objetivo pasa por aqui). */
function targetWhere(userId: string, target: AdjustmentTarget) {
  const ofTarget = (() => {
    switch (target.type) {
      case 'ACCOUNT':
        return eq(balanceAdjustments.accountId, target.id);
      case 'DEBT':
        return eq(balanceAdjustments.debtId, target.id);
      case 'GOAL':
        return eq(balanceAdjustments.goalId, target.id);
    }
  })();
  return and(eq(balanceAdjustments.userId, userId), ofTarget);
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
  sumDelta(db: DbOrTx, userId: string, target: AdjustmentTarget): number {
    const row = db
      .select({ total: sql<number>`coalesce(sum(${balanceAdjustments.deltaMinor}), 0)`.mapWith(Number) })
      .from(balanceAdjustments)
      .where(targetWhere(userId, target))
      .get();
    return row?.total ?? 0;
  },

  listFor(db: DbOrTx, userId: string, target: AdjustmentTarget): AdjustmentRow[] {
    return mapRows(
      db
        .select()
        .from(balanceAdjustments)
        .where(targetWhere(userId, target))
        .orderBy(asc(balanceAdjustments.createdAt))
        .all(),
    );
  },

  /** Devuelve el numero de ajustes borrados (0 = objetivo inexistente o ajeno). */
  deleteFor(db: DbOrTx, userId: string, target: AdjustmentTarget): number {
    return db
      .delete(balanceAdjustments)
      .where(targetWhere(userId, target))
      .returning({ id: balanceAdjustments.id })
      .all().length;
  },

  countFor(db: DbOrTx, userId: string, target: AdjustmentTarget, reason?: AdjustmentReason): number {
    const where = reason
      ? and(targetWhere(userId, target), eq(balanceAdjustments.reason, reason))
      : targetWhere(userId, target);
    const row = db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(balanceAdjustments)
      .where(where)
      .get();
    return row?.n ?? 0;
  },
};
