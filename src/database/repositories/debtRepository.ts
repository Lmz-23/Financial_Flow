// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// `owned(userId, id)` es el filtro comun de las consultas por id de deudas.
// Mutadores: devuelven el numero de filas afectadas con `.returning({ id }).all().length` (0 = id inexistente
// o ajeno). `RETURNING` requiere SQLite >= 3.35: expo-sqlite 56.0.5 empaqueta SQLite 3.50.3 (NO probado en
// dispositivo; los tests usan better-sqlite3).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)`, un `.where(...)` con
// `userId` en CADA consulta, `insert` con `v.userId`) y test/integration/repositories/ownership.test.ts
// (comportamiento con dos usuarios). LIMITE: la guarda comprueba que el `where` REFERENCIA `userId`, no que la
// columna o el operador sean correctos; eso lo cubren los tests de comportamiento y el fuzz (test/property).
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { debtBalance } from '../../domain/rules/statement';
import { newId } from '../ids';
import { balanceAdjustments, debts, transactions, type Debt } from '../schema';
import type { DbOrTx } from '../types';
import { adjustmentRepository } from './adjustmentRepository';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type DebtRow = DatesToMs<Debt>;
export type RateSource = Debt['rateSource'];

export interface InsertDebt {
  userId: string;
  name: string;
  installmentMinor: number | null;
  monthlyRate: number | null;
  rateSource: RateSource;
  initialPaidCount: number;
  totalCount: number | null;
  now: number;
}

export interface UpdateDebt {
  name?: string;
  installmentMinor?: number | null;
  now: number;
}

const num = (expr: ReturnType<typeof sql<number>>) => expr.mapWith(Number);

/**
 * Deuda `id` Y del usuario: toda consulta por id de este repositorio filtra por userId en el WHERE.
 * Los mutadores devuelven el numero de filas afectadas (0 = id inexistente o ajeno).
 */
const owned = (userId: string, id: string) => and(eq(debts.id, id), eq(debts.userId, userId));

export const debtRepository = {
  insert(db: DbOrTx, v: InsertDebt): string {
    const id = newId();
    db.insert(debts)
      .values({
        id,
        userId: v.userId,
        name: v.name,
        installmentMinor: v.installmentMinor,
        monthlyRate: v.monthlyRate,
        rateSource: v.rateSource,
        initialPaidCount: v.initialPaidCount,
        totalCount: v.totalCount,
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  /** Deuda del usuario; la de otro usuario es indistinguible de una inexistente (undefined). */
  getById(db: DbOrTx, userId: string, id: string): DebtRow | undefined {
    const row = db
      .select()
      .from(debts)
      .where(owned(userId, id))
      .get();
    return row ? mapRow(row) : undefined;
  },

  /** Deudas no archivadas (o todas con `includeArchived`). */
  list(db: DbOrTx, userId: string, includeArchived = false): DebtRow[] {
    const where = includeArchived
      ? eq(debts.userId, userId)
      : and(eq(debts.userId, userId), isNull(debts.archivedAt));
    return mapRows(db.select().from(debts).where(where).orderBy(asc(debts.createdAt)).all());
  },

  update(db: DbOrTx, userId: string, id: string, v: UpdateDebt): number {
    const set: Partial<typeof debts.$inferInsert> = { updatedAt: toDate(v.now) };
    if (v.name !== undefined) set.name = v.name;
    if (v.installmentMinor !== undefined) set.installmentMinor = v.installmentMinor;
    return db.update(debts).set(set).where(owned(userId, id)).returning({ id: debts.id }).all().length;
  },

  archive(db: DbOrTx, userId: string, id: string, now: number): number {
    return db
      .update(debts)
      .set({ archivedAt: toDate(now), updatedAt: toDate(now) })
      .where(owned(userId, id))
      .returning({ id: debts.id })
      .all().length;
  },

  delete(db: DbOrTx, userId: string, id: string): number {
    return db.delete(debts).where(owned(userId, id)).returning({ id: debts.id }).all().length;
  },

  /** Σ capital aplicado por los pagos de la deuda. */
  principalAppliedTotal(db: DbOrTx, userId: string, debtId: string): number {
    const row = db
      .select({ v: num(sql<number>`coalesce(sum(${transactions.debtPrincipalAppliedMinor}), 0)`) })
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), eq(transactions.debtId, debtId), eq(transactions.kind, 'DEBT_PAYMENT')),
      )
      .get();
    return row?.v ?? 0;
  },

  /** Saldo derivado (§3.1): Σ ajustes − Σ capital aplicado. */
  balanceOf(db: DbOrTx, userId: string, debtId: string): number {
    return debtBalance(
      adjustmentRepository.sumDelta(db, userId, { type: 'DEBT', id: debtId }),
      debtRepository.principalAppliedTotal(db, userId, debtId),
    );
  },

  /** Cuotas (INSTALLMENT) pagadas registradas en la app, sin el pagado inicial. */
  installmentPaymentCount(db: DbOrTx, userId: string, debtId: string): number {
    const row = db
      .select({ n: num(sql<number>`count(*)`) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.debtId, debtId),
          eq(transactions.debtPaymentType, 'INSTALLMENT'),
        ),
      )
      .get();
    return row?.n ?? 0;
  },

  /** Saldos de todas las deudas del usuario (incluidas archivadas), por id. */
  balancesByDebt(db: DbOrTx, userId: string): Map<string, number> {
    const adj = new Map<string, number>();
    const principal = new Map<string, number>();
    for (const r of db
      .select({
        debtId: balanceAdjustments.debtId,
        v: num(sql<number>`coalesce(sum(${balanceAdjustments.deltaMinor}), 0)`),
      })
      .from(balanceAdjustments)
      .where(and(eq(balanceAdjustments.userId, userId), eq(balanceAdjustments.targetType, 'DEBT')))
      .groupBy(balanceAdjustments.debtId)
      .all()) {
      if (r.debtId !== null) adj.set(r.debtId, r.v);
    }
    for (const r of db
      .select({
        debtId: transactions.debtId,
        v: num(sql<number>`coalesce(sum(${transactions.debtPrincipalAppliedMinor}), 0)`),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.kind, 'DEBT_PAYMENT')))
      .groupBy(transactions.debtId)
      .all()) {
      if (r.debtId !== null) principal.set(r.debtId, r.v);
    }
    const result = new Map<string, number>();
    for (const d of db.select({ id: debts.id }).from(debts).where(eq(debts.userId, userId)).all()) {
      result.set(d.id, debtBalance(adj.get(d.id) ?? 0, principal.get(d.id) ?? 0));
    }
    return result;
  },

  /** Cuotas (INSTALLMENT) registradas por deuda, sin el pagado inicial. */
  installmentCountsByDebt(db: DbOrTx, userId: string): Map<string, number> {
    const result = new Map<string, number>();
    for (const r of db
      .select({ debtId: transactions.debtId, n: num(sql<number>`count(*)`) })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.debtPaymentType, 'INSTALLMENT')))
      .groupBy(transactions.debtId)
      .all()) {
      if (r.debtId !== null) result.set(r.debtId, r.n);
    }
    return result;
  },
};
