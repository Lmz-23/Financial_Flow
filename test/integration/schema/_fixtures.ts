import { expect } from 'vitest';
import * as s from '../../../src/database/schema';
import type { TestDb } from '../../helpers/db';

type Db = TestDb['db'];

export const USER = 'u1';
const NOW = new Date('2026-01-15T12:00:00Z');

export function seedUser(db: Db, id = USER) {
  db.insert(s.users).values({ id }).run();
  return id;
}

export function mkAccount(db: Db, over: Partial<s.NewAccount> = {}) {
  const id = over.id ?? `acc_${Math.random().toString(36).slice(2, 8)}`;
  db.insert(s.accounts).values({ id, userId: USER, name: 'Efectivo', type: 'CASH', ...over }).run();
  return id;
}

export function mkCategory(db: Db, over: Partial<s.NewCategory> = {}) {
  const id = over.id ?? `cat_${Math.random().toString(36).slice(2, 8)}`;
  db.insert(s.categories).values({ id, userId: USER, name: 'Comida', type: 'EXPENSE', ...over }).run();
  return id;
}

export function mkDebt(db: Db, over: Partial<s.NewDebt> = {}) {
  const id = over.id ?? `debt_${Math.random().toString(36).slice(2, 8)}`;
  db.insert(s.debts).values({ id, userId: USER, name: 'Tarjeta', rateSource: 'UNKNOWN', ...over }).run();
  return id;
}

export function mkGoal(db: Db, over: Partial<s.NewGoal> = {}) {
  const id = over.id ?? `goal_${Math.random().toString(36).slice(2, 8)}`;
  db.insert(s.goals).values({ id, userId: USER, name: 'Viaje', targetMinor: 100000, ...over }).run();
  return id;
}

export function mkRecurring(db: Db, over: Partial<s.NewRecurringItem> = {}) {
  const id = over.id ?? `rec_${Math.random().toString(36).slice(2, 8)}`;
  db.insert(s.recurringItems)
    .values({ id, userId: USER, type: 'EXPENSE', name: 'Arriendo', amountMinor: 50000, frequency: 'MONTHLY', ...over })
    .run();
  return id;
}

/** Valores base validos de una transaccion; `over` los sobreescribe. */
export function txValues(accountId: string, over: Partial<s.NewTransaction> = {}): s.NewTransaction {
  return {
    userId: USER,
    accountId,
    type: 'EXPENSE',
    amountMinor: 1000,
    description: 'x',
    date: NOW,
    ...over,
  };
}

export function mkTx(db: Db, accountId: string, over: Partial<s.NewTransaction> = {}) {
  const id = over.id ?? `tx_${Math.random().toString(36).slice(2, 8)}`;
  db.insert(s.transactions).values({ id, ...txValues(accountId, over) }).run();
  return id;
}

/** Mensajes de toda la cadena de errores (drizzle envuelve el error de SQLite en `cause`). */
function messages(err: unknown): string {
  const out: string[] = [];
  let e: unknown = err;
  while (e instanceof Error) {
    out.push(e.message);
    e = (e as Error & { cause?: unknown }).cause;
  }
  return out.join(' | ');
}

/** Exige que `fn` falle y que el mensaje de SQLite contenga `fragment` (p. ej. el nombre del CHECK). */
export function expectFails(fn: () => unknown, fragment: string) {
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  expect(error, `se esperaba un fallo que contenga "${fragment}"`).toBeDefined();
  expect(messages(error)).toContain(fragment);
}

export const FK_FAIL = 'FOREIGN KEY constraint failed';
export const UNIQUE_FAIL = 'UNIQUE constraint failed';
