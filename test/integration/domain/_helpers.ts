import { expect } from 'vitest';
import { seedDatabase } from '../../../src/database/seed';
import { createDomain, type Domain } from '../../../src/domain/createDomain';
import type { AccountType } from '../../../src/database/repositories/accountRepository';
import { createTestDb } from '../../helpers/db';

/** Fecha local (zona de vitest: America/Bogota) como epoch ms. month 1-12. */
export function localMs(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

/** Reloj base de los tests: 2026-03-10 12:00 local. */
export const NOW = localMs(2026, 3, 10);

export interface TestEnv {
  d: Domain;
  db: ReturnType<typeof createTestDb>['db'];
  sqlite: ReturnType<typeof createTestDb>['sqlite'];
  clock: { now: number };
}

/** BD SQLite real en memoria (mismas migraciones + semilla) y dominio con reloj controlado. */
export function setup(): TestEnv {
  const t = createTestDb();
  seedDatabase(t.db);
  const clock = { now: NOW };
  const d = createDomain(t.db, { now: () => clock.now });
  return { d, db: t.db, sqlite: t.sqlite, clock };
}

/** Comprueba I1-I6 con IntegrityService (mensaje con las violaciones si falla). */
export function expectIntegrity(d: Domain): void {
  const report = d.integrity.check();
  expect(report.violations, JSON.stringify(report.violations)).toEqual([]);
  expect(report.ok).toBe(true);
}

export function mkAccount(d: Domain, name: string, openingMinor = 0, type: AccountType = 'CASH'): string {
  return d.accounts.create({ name, type, openingMinor }).result.id;
}

export function available(d: Domain, accountId: string): number {
  const view = d.accounts.get(accountId);
  if (!view) throw new Error(`cuenta inexistente ${accountId}`);
  return view.availableMinor;
}

export function count(env: TestEnv, table: string, where = '1=1'): number {
  const row = env.sqlite.prepare(`select count(*) as n from ${table} where ${where}`).get() as { n: number };
  return row.n;
}

/** Instala un trigger que aborta (como un CHECK fallido) la operacion SQL indicada. */
export function failOn(env: TestEnv, event: 'INSERT' | 'UPDATE' | 'DELETE', table: string, when = ''): void {
  env.sqlite.exec(
    `CREATE TRIGGER boom_${event}_${table} BEFORE ${event} ON ${table} ${when} BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
  );
}

export function clearFail(env: TestEnv, event: 'INSERT' | 'UPDATE' | 'DELETE', table: string): void {
  env.sqlite.exec(`DROP TRIGGER IF EXISTS boom_${event}_${table}`);
}

/** Ejecuta fn y devuelve el error lanzado (falla el test si no lanza). */
export function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('se esperaba que la operacion lanzara');
}
