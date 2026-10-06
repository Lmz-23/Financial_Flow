import { and, asc, eq, sql } from 'drizzle-orm';
import { newId } from '../ids';
import { goalContributions, type GoalContribution } from '../schema';
import type { DbOrTx } from '../types';
import { mapRows, toDate, type DatesToMs } from './mapping';

export type ContributionRow = DatesToMs<GoalContribution>;

export interface ContributionByAccount {
  accountId: string;
  amountMinor: number;
}

export const goalContributionRepository = {
  insert(
    db: DbOrTx,
    v: { userId: string; goalId: string; accountId: string; amountMinor: number; date: number; now: number },
  ): string {
    const id = newId();
    db.insert(goalContributions)
      .values({
        id,
        userId: v.userId,
        goalId: v.goalId,
        accountId: v.accountId,
        amountMinor: v.amountMinor,
        date: toDate(v.date),
        createdAt: toDate(v.now),
      })
      .run();
    return id;
  },

  listByGoal(db: DbOrTx, userId: string, goalId: string): ContributionRow[] {
    return mapRows(
      db
        .select()
        .from(goalContributions)
        .where(and(eq(goalContributions.userId, userId), eq(goalContributions.goalId, goalId)))
        .orderBy(asc(goalContributions.date), asc(goalContributions.createdAt))
        .all(),
    );
  },

  /** Total aportado por cuenta de origen (lo que se devuelve al borrar una meta activa). */
  totalsByAccount(db: DbOrTx, userId: string, goalId: string): ContributionByAccount[] {
    return db
      .select({
        accountId: goalContributions.accountId,
        amountMinor: sql<number>`sum(${goalContributions.amountMinor})`.mapWith(Number),
      })
      .from(goalContributions)
      .where(and(eq(goalContributions.userId, userId), eq(goalContributions.goalId, goalId)))
      .groupBy(goalContributions.accountId)
      .all();
  },

  /** Devuelve el numero de aportes borrados (0 = meta inexistente, ajena o sin aportes). */
  deleteByGoal(db: DbOrTx, userId: string, goalId: string): number {
    return db
      .delete(goalContributions)
      .where(and(eq(goalContributions.userId, userId), eq(goalContributions.goalId, goalId)))
      .returning({ id: goalContributions.id })
      .all().length;
  },
};
