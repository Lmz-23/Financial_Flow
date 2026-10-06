import { and, asc, eq, sql } from 'drizzle-orm';
import { newId } from '../ids';
import { balanceAdjustments, goalContributions, goals, type Goal } from '../schema';
import type { DbOrTx } from '../types';
import { adjustmentRepository } from './adjustmentRepository';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type GoalRow = DatesToMs<Goal>;
export type GoalStatus = Goal['status'];

const num = (expr: ReturnType<typeof sql<number>>) => expr.mapWith(Number);

export const goalRepository = {
  insert(db: DbOrTx, v: { userId: string; name: string; targetMinor: number; now: number }): string {
    const id = newId();
    db.insert(goals)
      .values({
        id,
        userId: v.userId,
        name: v.name,
        targetMinor: v.targetMinor,
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  getById(db: DbOrTx, id: string): GoalRow | undefined {
    const row = db.select().from(goals).where(eq(goals.id, id)).get();
    return row ? mapRow(row) : undefined;
  },

  list(db: DbOrTx, userId: string, status?: GoalStatus): GoalRow[] {
    const where = status ? and(eq(goals.userId, userId), eq(goals.status, status)) : eq(goals.userId, userId);
    return mapRows(db.select().from(goals).where(where).orderBy(asc(goals.createdAt)).all());
  },

  update(db: DbOrTx, id: string, v: { name?: string; targetMinor?: number; now: number }): void {
    const set: Partial<typeof goals.$inferInsert> = { updatedAt: toDate(v.now) };
    if (v.name !== undefined) set.name = v.name;
    if (v.targetMinor !== undefined) set.targetMinor = v.targetMinor;
    db.update(goals).set(set).where(eq(goals.id, id)).run();
  },

  /** ACTIVE -> SPENT con la foto del ahorro. */
  markSpent(db: DbOrTx, id: string, spentAmountMinor: number, now: number): void {
    db.update(goals)
      .set({ status: 'SPENT', spentAt: toDate(now), spentAmountMinor, updatedAt: toDate(now) })
      .where(eq(goals.id, id))
      .run();
  },

  delete(db: DbOrTx, id: string): void {
    db.delete(goals).where(eq(goals.id, id)).run();
  },

  /** Ahorro derivado (§3.1): Σ aportes + Σ ajustes de la meta. */
  savedOf(db: DbOrTx, goalId: string): number {
    const row = db
      .select({ v: num(sql<number>`coalesce(sum(${goalContributions.amountMinor}), 0)`) })
      .from(goalContributions)
      .where(eq(goalContributions.goalId, goalId))
      .get();
    return (row?.v ?? 0) + adjustmentRepository.sumDelta(db, { type: 'GOAL', id: goalId });
  },

  /** Ahorro derivado de todas las metas del usuario, por id. */
  savedByGoal(db: DbOrTx, userId: string): Map<string, number> {
    const result = new Map<string, number>();
    for (const g of db.select({ id: goals.id }).from(goals).where(eq(goals.userId, userId)).all()) {
      result.set(g.id, 0);
    }
    for (const r of db
      .select({
        goalId: goalContributions.goalId,
        v: num(sql<number>`coalesce(sum(${goalContributions.amountMinor}), 0)`),
      })
      .from(goalContributions)
      .where(eq(goalContributions.userId, userId))
      .groupBy(goalContributions.goalId)
      .all()) {
      result.set(r.goalId, (result.get(r.goalId) ?? 0) + r.v);
    }
    for (const r of db
      .select({
        goalId: balanceAdjustments.goalId,
        v: num(sql<number>`coalesce(sum(${balanceAdjustments.deltaMinor}), 0)`),
      })
      .from(balanceAdjustments)
      .where(and(eq(balanceAdjustments.userId, userId), eq(balanceAdjustments.targetType, 'GOAL')))
      .groupBy(balanceAdjustments.goalId)
      .all()) {
      if (r.goalId !== null) result.set(r.goalId, (result.get(r.goalId) ?? 0) + r.v);
    }
    return result;
  },
};
