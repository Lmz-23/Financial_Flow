// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// Mutadores: `update` y `delete` devuelven el numero de filas afectadas con `.returning({ id }).all().length`
// (0 = id inexistente o ajeno). `update` nunca toca `userId` (guarda R7).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST) y test/integration/repositories/ownership.test.ts.
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { newId } from '../ids';
import { accountTransfers, accounts, type AccountTransfer } from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, toDate, type DatesToMs } from './mapping';

export type AccountTransferRow = DatesToMs<AccountTransfer>;

/** Transferencia con los nombres de sus cuentas (para listas y detalle). */
export interface AccountTransferView extends AccountTransferRow {
  fromAccountName: string;
  toAccountName: string;
}

export interface AccountTransferFilters {
  /** Epoch ms, inclusive. */
  from?: number;
  /** Epoch ms, exclusivo. */
  to?: number;
  /** Transferencias donde la cuenta es origen O destino. */
  accountId?: string;
  limit?: number;
}

const fromAccount = alias(accounts, 'from_account');
const toAccount = alias(accounts, 'to_account');

export const accountTransferRepository = {
  insert(
    db: DbOrTx,
    v: {
      userId: string;
      fromAccountId: string;
      toAccountId: string;
      amountMinor: number;
      date: number;
      note: string | null;
      now: number;
    },
  ): string {
    const id = newId();
    db.insert(accountTransfers)
      .values({
        id,
        userId: v.userId,
        fromAccountId: v.fromAccountId,
        toAccountId: v.toAccountId,
        amountMinor: v.amountMinor,
        date: toDate(v.date),
        note: v.note,
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  getById(db: DbOrTx, userId: string, id: string): AccountTransferRow | undefined {
    const row = db
      .select()
      .from(accountTransfers)
      .where(and(eq(accountTransfers.id, id), eq(accountTransfers.userId, userId)))
      .get();
    return row ? mapRow(row) : undefined;
  },

  getViewById(db: DbOrTx, userId: string, id: string): AccountTransferView | undefined {
    const row = db
      .select({ t: accountTransfers, fromAccountName: fromAccount.name, toAccountName: toAccount.name })
      .from(accountTransfers)
      .innerJoin(fromAccount, eq(fromAccount.id, accountTransfers.fromAccountId))
      .innerJoin(toAccount, eq(toAccount.id, accountTransfers.toAccountId))
      .where(and(eq(accountTransfers.id, id), eq(accountTransfers.userId, userId)))
      .get();
    return row
      ? { ...mapRow(row.t), fromAccountName: row.fromAccountName, toAccountName: row.toAccountName }
      : undefined;
  },

  /** De la mas reciente a la mas antigua. */
  list(db: DbOrTx, userId: string, f: AccountTransferFilters = {}): AccountTransferView[] {
    const conditions = [eq(accountTransfers.userId, userId)];
    if (f.from !== undefined) conditions.push(sql`${accountTransfers.date} >= ${f.from}`);
    if (f.to !== undefined) conditions.push(sql`${accountTransfers.date} < ${f.to}`);
    if (f.accountId) {
      conditions.push(
        or(eq(accountTransfers.fromAccountId, f.accountId), eq(accountTransfers.toAccountId, f.accountId))!,
      );
    }
    const query = db
      .select({ t: accountTransfers, fromAccountName: fromAccount.name, toAccountName: toAccount.name })
      .from(accountTransfers)
      .innerJoin(fromAccount, eq(fromAccount.id, accountTransfers.fromAccountId))
      .innerJoin(toAccount, eq(toAccount.id, accountTransfers.toAccountId))
      .where(and(...conditions))
      .orderBy(desc(accountTransfers.date), desc(accountTransfers.createdAt));
    const rows = f.limit !== undefined ? query.limit(f.limit).all() : query.all();
    return rows.map((row) => ({
      ...mapRow(row.t),
      fromAccountName: row.fromAccountName,
      toAccountName: row.toAccountName,
    }));
  },

  /** Devuelve el numero de filas modificadas (0 = id inexistente o ajeno). */
  update(
    db: DbOrTx,
    userId: string,
    id: string,
    v: {
      fromAccountId: string;
      toAccountId: string;
      amountMinor: number;
      date: number;
      note: string | null;
      now: number;
    },
  ): number {
    return db
      .update(accountTransfers)
      .set({
        fromAccountId: v.fromAccountId,
        toAccountId: v.toAccountId,
        amountMinor: v.amountMinor,
        date: toDate(v.date),
        note: v.note,
        updatedAt: toDate(v.now),
      })
      .where(and(eq(accountTransfers.id, id), eq(accountTransfers.userId, userId)))
      .returning({ id: accountTransfers.id })
      .all().length;
  },

  /** Devuelve el numero de filas borradas (0 = id inexistente o ajeno). */
  delete(db: DbOrTx, userId: string, id: string): number {
    return db
      .delete(accountTransfers)
      .where(and(eq(accountTransfers.id, id), eq(accountTransfers.userId, userId)))
      .returning({ id: accountTransfers.id })
      .all().length;
  },
};
