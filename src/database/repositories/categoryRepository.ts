import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { newId } from '../ids';
import { categories, type Category } from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type CategoryRow = DatesToMs<Category>;
export type CategoryType = Category['type'];

export const categoryRepository = {
  getById(db: DbOrTx, id: string): CategoryRow | undefined {
    const row = db.select().from(categories).where(eq(categories.id, id)).get();
    return row ? mapRow(row) : undefined;
  },

  /** Busca por nombre exacto entre las del usuario y las del sistema (userId NULL). */
  findByName(db: DbOrTx, userId: string, type: CategoryType, name: string): CategoryRow | undefined {
    const row = db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.type, type),
          eq(categories.name, name),
          or(eq(categories.userId, userId), isNull(categories.userId)),
        ),
      )
      .orderBy(asc(categories.order))
      .get();
    return row ? mapRow(row) : undefined;
  },

  /** Categorias activas del usuario y del sistema. */
  listActive(db: DbOrTx, userId: string, type?: CategoryType): CategoryRow[] {
    const scope = or(eq(categories.userId, userId), isNull(categories.userId));
    const where = type
      ? and(eq(categories.isActive, true), eq(categories.type, type), scope)
      : and(eq(categories.isActive, true), scope);
    return mapRows(db.select().from(categories).where(where).orderBy(asc(categories.type), asc(categories.order)).all());
  },

  maxOrder(db: DbOrTx, userId: string, type: CategoryType): number {
    const row = db
      .select({ m: sql<number>`coalesce(max(${categories.order}), -1)`.mapWith(Number) })
      .from(categories)
      .where(and(eq(categories.type, type), or(eq(categories.userId, userId), isNull(categories.userId))))
      .get();
    return row?.m ?? -1;
  },

  insert(db: DbOrTx, v: { userId: string; name: string; type: CategoryType; order: number; now: number }): string {
    const id = newId();
    db.insert(categories)
      .values({ id, userId: v.userId, name: v.name, type: v.type, order: v.order, isActive: true, createdAt: toDate(v.now) })
      .run();
    return id;
  },
};
