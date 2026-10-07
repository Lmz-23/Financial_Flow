// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// `owned(userId, id)` es el filtro comun de las consultas por id de recurrentes.
// Mutadores: devuelven el numero de filas afectadas con `.returning({ id }).all().length` (0 = id inexistente
// o ajeno). `RETURNING` requiere SQLite >= 3.35: expo-sqlite 56.0.5 empaqueta SQLite 3.50.3 (NO probado en
// dispositivo; los tests usan better-sqlite3).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)`, un `.where(...)` con
// `userId` en CADA consulta, `insert` con `v.userId`) y test/integration/repositories/ownership.test.ts
// (comportamiento con dos usuarios). LIMITE: la guarda comprueba que el `where` REFERENCIA `userId`, no que la
// columna o el operador sean correctos; eso lo cubren los tests de comportamiento y el fuzz (test/property).
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { newId } from '../ids';
import { recurringItems, type RecurringItem } from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type RecurringRow = DatesToMs<RecurringItem>;
export type RecurringFrequency = RecurringItem['frequency'];

export interface InsertRecurring {
  userId: string;
  type: RecurringItem['type'];
  kind: RecurringItem['kind'];
  debtId?: string | null;
  name: string | null;
  amountMinor: number | null;
  isPassive?: boolean;
  categoryId?: string | null;
  defaultAccountId?: string | null;
  frequency: RecurringFrequency;
  anchorDate: string | null;
  nextDueDate: string | null;
  now: number;
}

/** Cada campo `undefined` se deja intacto; `null` limpia el campo (si la columna lo admite). */
export interface UpdateRecurring {
  name?: string | null;
  amountMinor?: number | null;
  isPassive?: boolean;
  categoryId?: string | null;
  defaultAccountId?: string | null;
  frequency?: RecurringFrequency;
  anchorDate?: string | null;
  nextDueDate?: string | null;
  /** Epoch ms o null. */
  snoozedUntil?: number | null;
  now: number;
}

/**
 * Recurrente `id` Y del usuario: toda consulta por id de este repositorio filtra por userId en el
 * WHERE. Los mutadores devuelven el numero de filas afectadas (0 = id inexistente o ajeno).
 */
const owned = (userId: string, id: string) => and(eq(recurringItems.id, id), eq(recurringItems.userId, userId));

export const recurringRepository = {
  insert(db: DbOrTx, v: InsertRecurring): string {
    const id = newId();
    db.insert(recurringItems)
      .values({
        id,
        userId: v.userId,
        type: v.type,
        kind: v.kind,
        debtId: v.debtId ?? null,
        name: v.name,
        amountMinor: v.amountMinor,
        isPassive: v.isPassive ?? false,
        categoryId: v.categoryId ?? null,
        defaultAccountId: v.defaultAccountId ?? null,
        frequency: v.frequency,
        anchorDate: v.anchorDate,
        nextDueDate: v.nextDueDate,
        createdAt: toDate(v.now),
        updatedAt: toDate(v.now),
      })
      .run();
    return id;
  },

  /** Recurrente del usuario; el de otro usuario es indistinguible de uno inexistente (undefined). */
  getById(db: DbOrTx, userId: string, id: string): RecurringRow | undefined {
    const row = db
      .select()
      .from(recurringItems)
      .where(owned(userId, id))
      .get();
    return row ? mapRow(row) : undefined;
  },

  getByDebtId(db: DbOrTx, userId: string, debtId: string): RecurringRow | undefined {
    const row = db
      .select()
      .from(recurringItems)
      .where(and(eq(recurringItems.userId, userId), eq(recurringItems.debtId, debtId)))
      .get();
    return row ? mapRow(row) : undefined;
  },

  /** Recurrentes STANDARD del usuario (la gestion de cuotas de deuda es de DebtService). */
  listStandard(db: DbOrTx, userId: string): RecurringRow[] {
    return mapRows(
      db
        .select()
        .from(recurringItems)
        .where(and(eq(recurringItems.userId, userId), eq(recurringItems.kind, 'STANDARD')))
        .orderBy(asc(recurringItems.createdAt))
        .all(),
    );
  },

  /** Recurrentes activos con fecha (STANDARD y cuotas de deuda). */
  listActiveDated(db: DbOrTx, userId: string): RecurringRow[] {
    return mapRows(
      db
        .select()
        .from(recurringItems)
        .where(
          and(
            eq(recurringItems.userId, userId),
            eq(recurringItems.status, 'ACTIVE'),
            isNotNull(recurringItems.nextDueDate),
          ),
        )
        .orderBy(asc(recurringItems.nextDueDate), asc(recurringItems.createdAt))
        .all(),
    );
  },

  update(db: DbOrTx, userId: string, id: string, v: UpdateRecurring): number {
    const set: Partial<typeof recurringItems.$inferInsert> = { updatedAt: toDate(v.now) };
    if (v.name !== undefined) set.name = v.name;
    if (v.amountMinor !== undefined) set.amountMinor = v.amountMinor;
    if (v.isPassive !== undefined) set.isPassive = v.isPassive;
    if (v.categoryId !== undefined) set.categoryId = v.categoryId;
    if (v.defaultAccountId !== undefined) set.defaultAccountId = v.defaultAccountId;
    if (v.frequency !== undefined) set.frequency = v.frequency;
    if (v.anchorDate !== undefined) set.anchorDate = v.anchorDate;
    if (v.nextDueDate !== undefined) set.nextDueDate = v.nextDueDate;
    if (v.snoozedUntil !== undefined) set.snoozedUntil = v.snoozedUntil === null ? null : toDate(v.snoozedUntil);
    return db
      .update(recurringItems)
      .set(set)
      .where(owned(userId, id))
      .returning({ id: recurringItems.id })
      .all().length;
  },

  delete(db: DbOrTx, userId: string, id: string): number {
    return db.delete(recurringItems).where(owned(userId, id)).returning({ id: recurringItems.id }).all().length;
  },

  /** Los recurrentes que tenian la cuenta como predeterminada quedan sin cuenta. */
  clearDefaultAccount(db: DbOrTx, userId: string, accountId: string, now: number): number {
    return db
      .update(recurringItems)
      .set({ defaultAccountId: null, updatedAt: toDate(now) })
      .where(and(eq(recurringItems.userId, userId), eq(recurringItems.defaultAccountId, accountId)))
      .returning({ id: recurringItems.id })
      .all().length;
  },
};
