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

  // Lee el archivo ya: abrirlo no lo toca, y si otra pestaña o la página anterior aún lo tiene, el
  // fallo debe salir aquí (donde `connectOrReload` lo atiende) y no en las migraciones.
  sqlite.getFirstSync('SELECT count(*) AS n FROM sqlite_master');

  return drizzle(sqlite, { schema });
}

export type Database = ReturnType<typeof connect>;

// Asignado por `prepareDatabase`; los modulos lo leen al usarlo, no al importarlo.
export let db: Database;

let preparing: Promise<void> | undefined;

/**
 * Al recargar o cambiar de dirección, la página anterior puede tener el archivo aún abierto unos
 * milisegundos y el navegador rechaza la apertura (OPFS: «Access Handles cannot be created if there
 * is another open Access Handle»). Tras ese fallo, wa-sqlite queda inservible hasta recargar, así
 * que se recarga la página una vez (dos como máximo seguidas) en vez de mostrar el error.
 */
const RELOAD_KEY = 'ff-db-open-reloads';
const MAX_RELOADS = 2;
const RELOAD_DELAY_MS = 400;

function readReloads(): number {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_KEY) ?? '0');
  } catch {
    return MAX_RELOADS; // sin sessionStorage no se puede evitar un bucle: no recargar
  }
}

function writeReloads(count: number): void {
  try {
    if (count === 0) window.sessionStorage.removeItem(RELOAD_KEY);
    else window.sessionStorage.setItem(RELOAD_KEY, String(count));
  } catch {
    // sin sessionStorage: nada que guardar
  }
}

function isFileBusy(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /NoModificationAllowedError|Access Handle/i.test(text);
}

async function openOrReload(): Promise<Database> {
  try {
    // Arranca el worker y carga el WASM sin bloquear el hilo principal; la VFS de OPFS toma el
    // archivo aquí mismo, así que este paso también puede fallar si el archivo está ocupado.
    const warmup = await openDatabaseAsync(':memory:');
    await warmup.closeAsync();
    const connection = connect();
    writeReloads(0);
    return connection;
  } catch (error) {
    const reloads = readReloads();
    // Solo se recarga si el archivo está ocupado; cualquier otro fallo sale como error. El contador
    // no se reinicia al fallar, para que «Reintentar» no vuelva a encadenar recargas.
    if (typeof window === 'undefined' || !isFileBusy(error) || reloads >= MAX_RELOADS) throw error;
    writeReloads(reloads + 1);
    setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    // La pantalla de carga se queda hasta que la página recarga.
    return new Promise<Database>(() => {});
  }
}

export function prepareDatabase(): Promise<void> {
  preparing ??= (async () => {
    db = await openOrReload();
  })().catch((error: unknown) => {
    preparing = undefined; // permite reintentar tras un fallo
    throw error;
  });
  return preparing;
}

export { schema };
export type { AppDatabase, DbOrTx } from './types';
