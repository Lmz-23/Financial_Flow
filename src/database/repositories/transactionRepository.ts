// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// Mutadores: `delete` y `unlinkRecurring` (numero de filas). Las consultas por id filtran `id` Y `userId`.
// Mutadores: devuelven el numero de filas afectadas con `.returning({ id }).all().length` (0 = id inexistente
// o ajeno). `RETURNING` requiere SQLite >= 3.35: expo-sqlite 56.0.5 empaqueta SQLite 3.50.3 (NO probado en
// dispositivo; los tests usan better-sqlite3).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)`, un `.where(...)` con
// `userId` en CADA consulta, `insert` con `v.userId`) y test/integration/repositories/ownership.test.ts
// (comportamiento con dos usuarios). LIMITE: la guarda comprueba que el `where` REFERENCIA `userId`, no que la
// columna o el operador sean correctos; eso lo cubren los tests de comportamiento y el fuzz (test/property).
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { newId } from '../ids';
import { accounts, categories, debts, transactions, type Transaction } from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type TransactionRow = DatesToMs<Transaction>;

/** Transaccion con los nombres relacionados (para listas y detalle). */
export interface TransactionView extends TransactionRow {
  accountName: string;
  categoryName: string | null;
  debtName: string | null;
}

export interface InsertTransaction {
  userId: string;
  accountId: string;
  type: Transaction['type'];
  kind: Transaction['kind'];
  amountMinor: number;
  description: string;
  /** Epoch ms. */
  date: number;
  categoryId?: string | null;
  isPassive?: boolean;
  debtId?: string | null;
  debtPaymentType?: Transaction['debtPaymentType'];
  debtPrincipalAppliedMinor?: number | null;
  recurringItemId?: string | null;
  occurrenceDate?: string | null;
  now: number;
}

export interface TransactionFilters {
  /** Epoch ms, inclusive. */
  from?: number;
  /** Epoch ms, exclusivo. */
  to?: number;
  accountId?: string;
  type?: Transaction['type'];
  limit?: number;
}

export const transactionRepository = {
  insert(db: DbOrTx, v: InsertTransaction): string {
    const id = newId();
    db.insert(transactions)
      .values({
        id,
        userId: v.userId,
        accountId: v.accountId,
        type: v.type,
        kind: v.kind,
        amountMinor: v.amountMinor,
        description: v.description,
        date: toDate(v.date),
        categoryId: v.categoryId ?? null,
        isPassive: v.isPassive ?? false,
        debtId: v.debtId ?? null,
        debtPaymentType: v.debtPaymentType ?? null,
        debtPrincipalAppliedMinor: v.debtPrincipalAppliedMinor ?? null,
        recurringItemId: v.recurringItemId ?? null,
        occurrenceDate: v.occurrenceDate ?? null,
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  /** Transaccion del usuario; la de otro usuario es indistinguible de una inexistente (undefined). */
  getById(db: DbOrTx, userId: string, id: string): TransactionRow | undefined {
    const row = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .get();
    return row ? mapRow(row) : undefined;
  },

  getViewById(db: DbOrTx, userId: string, id: string): TransactionView | undefined {
    const row = db
      .select({
        t: transactions,
        accountName: accounts.name,
        categoryName: categories.name,
        debtName: debts.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(debts, eq(debts.id, transactions.debtId))
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .get();
    return row
      ? { ...mapRow(row.t), accountName: row.accountName, categoryName: row.categoryName, debtName: row.debtName }
      : undefined;
  },

  list(db: DbOrTx, userId: string, f: TransactionFilters = {}): TransactionView[] {
    const conditions = [eq(transactions.userId, userId)];
    if (f.from !== undefined) conditions.push(sql`${transactions.date} >= ${f.from}`);
    if (f.to !== undefined) conditions.push(sql`${transactions.date} < ${f.to}`);
    if (f.accountId) conditions.push(eq(transactions.accountId, f.accountId));
    if (f.type) conditions.push(eq(transactions.type, f.type));
    const query = db
      .select({
        t: transactions,
        accountName: accounts.name,
        categoryName: categories.name,
        debtName: debts.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(debts, eq(debts.id, transactions.debtId))
      .where(and(...conditions))
      .orderBy(desc(transactions.date), desc(transactions.createdAt));
    const rows = f.limit !== undefined ? query.limit(f.limit).all() : query.all();
    return rows.map((row) => ({
      ...mapRow(row.t),
      accountName: row.accountName,
      categoryName: row.categoryName,
      debtName: row.debtName,
    }));
  },

  /**
   * Edita los campos editables de una transaccion STANDARD o de un ingreso/gasto (tipo, kind, deuda y vinculo con
   * el recurrente NO cambian). Devuelve el numero de filas modificadas (0 = id inexistente o ajeno).
   */
  update(
    db: DbOrTx,
    userId: string,
    id: string,
    v: {
      accountId: string;
      amountMinor: number;
      description: string;
      date: number;
      categoryId: string | null;
      isPassive: boolean;
      now: number;
    },
  ): number {
    return db
      .update(transactions)
      .set({
        accountId: v.accountId,
        amountMinor: v.amountMinor,
        description: v.description,
        date: toDate(v.date),
        categoryId: v.categoryId,
        isPassive: v.isPassive,
        updatedAt: toDate(v.now),
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning({ id: transactions.id })
      .all().length;
  },

  /** Devuelve el numero de filas borradas (0 = id inexistente o ajeno). */
  delete(db: DbOrTx, userId: string, id: string): number {
    return db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning({ id: transactions.id })
      .all().length;
  },

  findByOccurrence(
    db: DbOrTx,
    userId: string,
    recurringItemId: string,
    occurrenceDate: string,
  ): TransactionRow | undefined {
    const row = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.recurringItemId, recurringItemId),
          eq(transactions.occurrenceDate, occurrenceDate),
        ),
      )
      .get();
    return row ? mapRow(row) : undefined;
  },

  /** Fechas de ocurrencia con transaccion ligada a un recurrente. */
  confirmedOccurrences(db: DbOrTx, userId: string, recurringItemId: string): string[] {
    return db
      .select({ occ: transactions.occurrenceDate })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.recurringItemId, recurringItemId),
          isNotNull(transactions.occurrenceDate),
        ),
      )
      .all()
      .map((r) => r.occ as string);
  },

  /** Pagos de una deuda (transacciones DEBT_PAYMENT). */
  countPaymentsOfDebt(db: DbOrTx, userId: string, debtId: string): number {
    const row = db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.debtId, debtId)))
      .get();
    return row?.n ?? 0;
  },

  listPaymentsOfDebt(db: DbOrTx, userId: string, debtId: string): TransactionRow[] {
    return mapRows(
      db
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.debtId, debtId)))
        .orderBy(desc(transactions.date))
        .all(),
    );
  },

  /** Desvincula las transacciones de un recurrente (quedan con recurringItemId NULL). */
  unlinkRecurring(db: DbOrTx, userId: string, recurringItemId: string): number {
    return db
      .update(transactions)
      .set({ recurringItemId: null })
      .where(and(eq(transactions.userId, userId), eq(transactions.recurringItemId, recurringItemId)))
      .returning({ id: transactions.id })
      .all().length;
  },
};
