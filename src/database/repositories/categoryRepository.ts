// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio que opera por id recibe
// `userId` y lo filtra EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// Convencion de firma `(db, userId, id, ...)`; unica excepcion `insert(db, v)`, que lleva el userId dentro
// de la fila `v` (el servicio pasa `userId: ctx.userId`). Un id de otro usuario es indistinguible de uno
// inexistente (`undefined` / 0 filas).
// Las categorias son del usuario O del sistema (`userId` NULL): el filtro es `userId = ? OR userId IS NULL`, asi que
// las del sistema las ven todos y las propias solo su dueno. No tiene mutadores por id: solo consultas de lectura
// y `insert`, que no devuelven conteo de filas (`insert` devuelve el id nuevo).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)`, un `.where(...)` con
// `userId` en CADA consulta, `insert` con `v.userId`) y test/integration/repositories/ownership.test.ts
// (comportamiento con dos usuarios). LIMITE: la guarda comprueba que el `where` REFERENCIA `userId`, no que la
// columna o el operador sean correctos; eso lo cubren los tests de comportamiento y el fuzz (test/property).
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { newId } from '../ids';
import { categories, type Category } from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, mapRows, toDate, type DatesToMs } from './mapping';

export type CategoryRow = DatesToMs<Category>;
export type CategoryType = Category['type'];

export const categoryRepository = {
  /**
   * Categoria accesible al usuario: propia o del sistema (userId NULL). La de otro usuario es
   * indistinguible de una inexistente (undefined).
   */
  getById(db: DbOrTx, userId: string, id: string): CategoryRow | undefined {
    const row = db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), or(eq(categories.userId, userId), isNull(categories.userId))))
      .get();
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
