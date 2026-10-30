import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

/**
 * UNICA importacion de `expo-sqlite` del proyecto. El dominio y los tests reciben la BD por
 * inyeccion (ver types.ts: AppDatabase) y nunca importan este archivo.
 *
 * Nombre nuevo (`-v1`) para partir de una BD limpia sin chocar con `financial-flow.db`
 * (cuyo `__drizzle_migrations` tiene el hash de la migracion anterior).
 */
export const DATABASE_NAME = 'financial-flow-v1.db';

const sqlite = openDatabaseSync(DATABASE_NAME);

// SQLite deja las claves foraneas DESACTIVADAS por conexion salvo que se activen. La documentacion
// de expo-sqlite (v56, "Executing PRAGMA queries") ejecuta `PRAGMA foreign_keys = ON` explicitamente.
// Debe ser lo PRIMERO que se ejecuta y es un no-op dentro de una transaccion abierta.
sqlite.execSync('PRAGMA foreign_keys = ON');

// Falla cerrado: si el PRAGMA no quedo activo, RESTRICT/CASCADE/SET NULL no funcionarian.
const fk = sqlite.getFirstSync<{ foreign_keys: number }>('PRAGMA foreign_keys');
if (!fk || fk.foreign_keys !== 1) {
  throw new Error('PRAGMA foreign_keys no quedo activo en la conexion de expo-sqlite.');
}

// No se usa `enableChangeListener`: el refresco de la UI va por el store de invalidacion
// (arquitectura §4.1), no por useLiveQuery.

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;

/** En nativo la conexion ya esta abierta. La variante web (`client.web.ts`) si necesita prepararla. */
export function prepareDatabase(): Promise<void> {
  return Promise.resolve();
}
export { schema };
export type { AppDatabase, DbOrTx } from './types';
