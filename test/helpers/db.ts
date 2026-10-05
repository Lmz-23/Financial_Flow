import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/database/schema';

export const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../src/database/migrations');

export interface TestDb {
  /** drizzle sobre SQLite real (en memoria); compatible con AppDatabase. */
  db: ReturnType<typeof createDrizzle>;
  /** Conexion better-sqlite3 cruda (para PRAGMA y SQL directo). */
  sqlite: Database.Database;
  close: () => void;
}

function createDrizzle(sqlite: Database.Database) {
  return drizzle(sqlite, { schema });
}

/**
 * BD en memoria con foreign_keys=ON EXPLICITO y las MISMAS migraciones que la app
 * (src/database/migrations). No importa expo-sqlite.
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = createDrizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, sqlite, close: () => sqlite.close() };
}
