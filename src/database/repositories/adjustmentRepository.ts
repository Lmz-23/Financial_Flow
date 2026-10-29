// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// `targetWhere(userId, target)` es el filtro comun por objetivo (cuenta, deuda o meta) Y usuario.
// Mutador: `deleteFor` (numero de ajustes borrados).
// Mutadores: devuelven el numero de filas afectadas con `.returning({ id }).all().length` (0 = id inexistente
// o ajeno). `RETURNING` requiere SQLite >= 3.35: expo-sqlite 56.0.5 empaqueta SQLite 3.50.3 (NO probado en
// dispositivo; los tests usan better-sqlite3).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)`, un `.where(...)` con
// `userId` en CADA consulta, `insert` con `v.userId`) y test/integration/repositories/ownership.test.ts
// (comportamiento con dos usuarios). LIMITE: la guarda comprueba que el `where` REFERENCIA `userId`, no que la
// columna o el operador sean correctos; eso lo cubren los tests de comportamiento y el fuzz (test/property).
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
