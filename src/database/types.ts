import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

/**
 * Tipo de BD compartido por la app (drizzle expo-sqlite) y los tests (drizzle better-sqlite3).
 * Ambos son SQLite sincronos; el segundo parametro (resultado de run) difiere, por eso `any`.
 * Este archivo NO importa expo-sqlite, asi que es seguro importarlo desde node/vitest.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', any, typeof schema>;

/** Transaccion de drizzle (callback de `db.transaction`) o la propia BD: ambas aceptan consultas. */
export type DbOrTx = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete' | 'run' | 'get' | 'all' | 'query'>;
