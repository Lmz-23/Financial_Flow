// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// `owned(userId, id)` es el filtro comun de las consultas por id de metas.
// Mutadores: devuelven el numero de filas afectadas con `.returning({ id }).all().length` (0 = id inexistente
// o ajeno). `RETURNING` requiere SQLite >= 3.35: expo-sqlite 56.0.5 empaqueta SQLite 3.50.3 (NO probado en
// dispositivo; los tests usan better-sqlite3).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)`, un `.where(...)` con
// `userId` en CADA consulta, `insert` con `v.userId`) y test/integration/repositories/ownership.test.ts
// (comportamiento con dos usuarios). LIMITE: la guarda comprueba que el `where` REFERENCIA `userId`, no que la
// columna o el operador sean correctos; eso lo cubren los tests de comportamiento y el fuzz (test/property).
import { and, asc, eq, sql } from 'drizzle-orm';
import { newId } from '../ids';
import { balanceAdjustments, goalContributions, goals, type Goal } from '../schema';
import type { DbOrTx } from '../types';
import { adjustmentRepository } from './adjustmentRepository';
import { mapRow, mapRows, toDate, toDateOrNull, type DatesToMs } from './mapping';

export type GoalRow = DatesToMs<Goal>;
export type GoalStatus = Goal['status'];

const num = (expr: ReturnType<typeof sql<number>>) => expr.mapWith(Number);

/**
 * Meta `id` Y del usuario: toda consulta por id de este repositorio filtra por userId en el WHERE.
 * Los mutadores devuelven el numero de filas afectadas (0 = id inexistente o ajeno).
 */
const owned = (userId: string, id: string) => and(eq(goals.id, id), eq(goals.userId, userId));

export const goalRepository = {
  insert(
    db: DbOrTx,
    v: { userId: string; name: string; targetMinor: number; targetDate?: number | null; now: number },
  ): string {
    const id = newId();
    db.insert(goals)
      .values({
        id,
        userId: v.userId,
        name: v.name,
        targetMinor: v.targetMinor,
        targetDate: toDateOrNull(v.targetDate ?? null),
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  /** Meta del usuario; la de otro usuario es indistinguible de una inexistente (undefined). */
  getById(db: DbOrTx, userId: string, id: string): GoalRow | undefined {
    const row = db
      .select()
      .from(goals)
      .where(owned(userId, id))
      .get();
    return row ? mapRow(row) : undefined;
  },

  list(db: DbOrTx, userId: string, status?: GoalStatus): GoalRow[] {
    const where = status ? and(eq(goals.userId, userId), eq(goals.status, status)) : eq(goals.userId, userId);
    return mapRows(db.select().from(goals).where(where).orderBy(asc(goals.createdAt)).all());
  },

  /** `targetDate`: epoch ms; `null` la limpia; `undefined` la deja intacta. */
  update(
    db: DbOrTx,
    userId: string,
    id: string,
    v: { name?: string; targetMinor?: number; targetDate?: number | null; now: number },
  ): number {
    const set: Partial<typeof goals.$inferInsert> = { updatedAt: toDate(v.now) };
    if (v.name !== undefined) set.name = v.name;
    if (v.targetMinor !== undefined) set.targetMinor = v.targetMinor;
    if (v.targetDate !== undefined) set.targetDate = toDateOrNull(v.targetDate);
    return db.update(goals).set(set).where(owned(userId, id)).returning({ id: goals.id }).all().length;
  },

  /** ACTIVE -> SPENT con la foto del ahorro. */
  markSpent(db: DbOrTx, userId: string, id: string, spentAmountMinor: number, now: number): number {
    return db
      .update(goals)
      .set({ status: 'SPENT', spentAt: toDate(now), spentAmountMinor, updatedAt: toDate(now) })
      .where(owned(userId, id))
      .returning({ id: goals.id })
      .all().length;
  },

  delete(db: DbOrTx, userId: string, id: string): number {
    return db.delete(goals).where(owned(userId, id)).returning({ id: goals.id }).all().length;
  },

  /** Ahorro derivado (§3.1): Σ aportes + Σ ajustes de la meta. */
  savedOf(db: DbOrTx, userId: string, goalId: string): number {
    const row = db
      .select({ v: num(sql<number>`coalesce(sum(${goalContributions.amountMinor}), 0)`) })
      .from(goalContributions)
      .where(and(eq(goalContributions.userId, userId), eq(goalContributions.goalId, goalId)))
      .get();
    return (row?.v ?? 0) + adjustmentRepository.sumDelta(db, userId, { type: 'GOAL', id: goalId });
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
