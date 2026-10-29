import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from './client';
import migrations from './migrations/migrations';
import { seedDatabase } from './seed';

/**
 * Inicializa la BD: aplica las migraciones generadas por drizzle-kit y luego el seed.
 *
 * - `migrations` es el `migrations.js` que genera `npm run db:generate` (driver 'expo'); los .sql
 *   se inlinean via babel-plugin-inline-import + sourceExts 'sql'. No hay espejo .ts manual.
 * - Idempotente: drizzle registra lo aplicado en `__drizzle_migrations`; el seed usa
 *   onConflictDoNothing. Llamadas concurrentes o repetidas comparten la misma promesa.
 * - La app debe ESPERAR esta promesa antes de renderizar. Firma compatible con la anterior:
 *   `initializeDatabase(): Promise<void>`.
 */
let initialization: Promise<void> | undefined;

export function initializeDatabase(): Promise<void> {
  initialization ??= run().catch((error) => {
    initialization = undefined; // permite reintentar tras un fallo
    throw error;
  });
  return initialization;
}

async function run(): Promise<void> {
  await migrate(db, migrations);
  seedDatabase(db);
}

// Regenerar migraciones: editar src/database/schema.ts -> `npm run db:generate` -> versionar el
// resultado (.sql, meta/, migrations.js). Verificar con `npm run db:check`. No editar a mano.
