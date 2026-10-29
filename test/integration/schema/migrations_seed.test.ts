import { afterEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import * as s from '../../../src/database/schema';
import { seedDatabase, DEFAULT_USER_ID } from '../../../src/database/seed';
import { newId } from '../../../src/database/ids';
import { createTestDb, type TestDb } from '../../helpers/db';

let t: TestDb | undefined;
afterEach(() => { t?.close(); t = undefined; });

const EXPECTED_TABLES = [
  'account_transfers', 'accounts', 'balance_adjustments', 'categories', 'debts', 'goal_contributions',
  'goals', 'recurring_items', 'transactions', 'users',
];
const RETIRED_TABLES = ['pockets', 'budgets_monthly', 'distribution_rules', 'debt_cards', 'debt_loans'];

describe('migrador sobre BD vacia', () => {
  it('produce exactamente las tablas esperadas y ninguna retirada', () => {
    t = createTestDb();
    const names = (t.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations' ORDER BY name").all() as { name: string }[])
      .map((r) => r.name);
    expect(names).toEqual(EXPECTED_TABLES);
    for (const r of RETIRED_TABLES) expect(names).not.toContain(r);
  });
  it('registra una fila por migracion del journal (0000 esquema, 0001 triggers de propietario, 0002 transferencias)', () => {
    t = createTestDb();
    const n = t.sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number };
    expect(n.n).toBe(3);
  });
  it('crea el UNIQUE parcial y los indices esperados', () => {
    t = createTestDb();
    const idx = t.sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND name='uq_tx_recurring_occurrence'").get() as { sql: string };
    expect(idx.sql).toMatch(/UNIQUE INDEX/i);
    expect(idx.sql).toMatch(/WHERE .*recurring_item_id.* IS NOT NULL/i);
  });
  it('la BD resultante no tiene violaciones de FK ni de integridad', () => {
    t = createTestDb();
    expect(t.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(t.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
  });
});

describe('seed', () => {
  it('inserta el usuario por defecto con sus valores por defecto y los widgets en NULL', () => {
    t = createTestDb();
    seedDatabase(t.db);
    const u = t.db.select().from(s.users).where(eq(s.users.id, DEFAULT_USER_ID)).get()!;
    expect(u).toMatchObject({
      id: 'default-user', currency: 'COP', themePreference: 'system', reminderHour: 9,
      notifyPaymentReminders: true, notifyWeeklySummary: true,
      widgetCashflow: null, widgetDebts: null, widgetGoals: null, onboardingCompletedAt: null,
    });
  });
  it('categorias base: gasto e ingreso segun el diseño, userId NULL y sin "Deudas"', () => {
    t = createTestDb();
    seedDatabase(t.db);
    const sys = (type: 'EXPENSE' | 'INCOME') =>
      t!.db.select().from(s.categories)
        .where(and(isNull(s.categories.userId), eq(s.categories.type, type)))
        .orderBy(s.categories.order).all().map((c) => c.name);
    expect(sys('EXPENSE')).toEqual(['Comida', 'Transporte', 'Servicios', 'Salud', 'Otro']);
    expect(sys('INCOME')).toEqual(['Sueldo', 'Freelance', 'Ventas', 'Regalo', 'Otro']);
    expect(t.db.select().from(s.categories).all().some((c) => c.name === 'Deudas')).toBe(false);
  });
  it('es idempotente: ejecutarlo dos (o tres) veces no duplica nada', () => {
    t = createTestDb();
    seedDatabase(t.db);
    seedDatabase(t.db);
    seedDatabase(t.db);
    expect(t.db.select().from(s.users).all()).toHaveLength(1);
    expect(t.db.select().from(s.categories).all()).toHaveLength(10);
  });
  it('no pisa los cambios del usuario sobre su fila', () => {
    t = createTestDb();
    seedDatabase(t.db);
    t.db.update(s.users).set({ themePreference: 'dark', widgetGoals: 1 }).where(eq(s.users.id, DEFAULT_USER_ID)).run();
    seedDatabase(t.db);
    const u = t.db.select().from(s.users).get()!;
    expect(u.themePreference).toBe('dark');
    expect(u.widgetGoals).toBe(1);
  });
});

describe('newId', () => {
  it('genera UUID v4 unicos', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('funciona sin crypto.randomUUID (como podria pasar en Hermes)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      for (const fake of [undefined, { getRandomValues: (a: Uint8Array) => a.fill(7) }]) {
        Object.defineProperty(globalThis, 'crypto', { value: fake, configurable: true, writable: true });
        expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      }
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
});
