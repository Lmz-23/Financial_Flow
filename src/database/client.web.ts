import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

/**
 * Variante web (escritorio) de `client.ts`; mismas exportaciones.
 *
 * En web, expo-sqlite corre SQLite (WASM) en un worker y su API sincrona espera al worker con un
 * bucle activo en el hilo principal. El worker no arranca mientras ese hilo esta bloqueado, asi
 * que la PRIMERA operacion no puede ser sincrona: `prepareDatabase` arranca el worker con una
 * apertura asincrona y solo despues abre la conexion sincrona que usa drizzle. Por eso `db` no
 * existe hasta que termina `prepareDatabase` (lo llama `initializeDatabase`).
 */
export const DATABASE_NAME = 'financial-flow-v1.db';

function connect() {
  const sqlite = openDatabaseSync(DATABASE_NAME);

  // Igual que en nativo: claves foraneas activas y verificadas antes de cualquier otra cosa.
  sqlite.execSync('PRAGMA foreign_keys = ON');
  const fk = sqlite.getFirstSync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (!fk || fk.foreign_keys !== 1) {
    throw new Error('PRAGMA foreign_keys no quedo activo en la conexion de expo-sqlite.');
  }

  return drizzle(sqlite, { schema });
}

export type Database = ReturnType<typeof connect>;

// Asignado por `prepareDatabase`; los modulos lo leen al usarlo, no al importarlo.
export let db: Database;

let preparing: Promise<void> | undefined;

export function prepareDatabase(): Promise<void> {
  preparing ??= (async () => {
    // Arranca el worker y carga el WASM sin bloquear el hilo principal.
    const warmup = await openDatabaseAsync(':memory:');
    await warmup.closeAsync();
    db = connect();
  })().catch((error: unknown) => {
    preparing = undefined; // permite reintentar tras un fallo
    throw error;
  });
  return preparing;
}

export { schema };
export type { AppDatabase, DbOrTx } from './types';
