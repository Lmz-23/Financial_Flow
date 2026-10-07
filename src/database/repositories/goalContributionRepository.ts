// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// Mutador: `deleteByGoal` (numero de aportes borrados). Todas las consultas filtran por `userId` Y meta.
// Mutadores: devuelven el numero de filas afectadas con `.returning({ id }).all().length` (0 = id inexistente
// o ajeno). `RETURNING` requiere SQLite >= 3.35: expo-sqlite 56.0.5 empaqueta SQLite 3.50.3 (NO probado en
// dispositivo; los tests usan better-sqlite3).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)`, un `.where(...)` con
// `userId` en CADA consulta, `insert` con `v.userId`) y test/integration/repositories/ownership.test.ts
// (comportamiento con dos usuarios). LIMITE: la guarda comprueba que el `where` REFERENCIA `userId`, no que la
// columna o el operador sean correctos; eso lo cubren los tests de comportamiento y el fuzz (test/property).
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
