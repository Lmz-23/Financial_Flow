// Triggers de propietario (src/database/migrations/0001_owner_triggers.sql): la BD rechaza que una fila
// referencie una fila de OTRO usuario (OWNER_MISMATCH) y que un UPDATE cambie `user_id` (OWNER_IMMUTABLE).
// Sustituyen a las FK compuestas (id, user_id): no reconstruyen tablas ni cambian ningun ON DELETE.
// Tambien se prueba la ACTUALIZACION de una BD con datos que solo tenia la migracion 0000 (usuarios reales).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import * as schema from '../../../src/database/schema';
import { DEFAULT_USER_ID, seedDatabase } from '../../../src/database/seed';
import { createDomain, type Domain } from '../../../src/domain/createDomain';
import { MIGRATIONS_FOLDER } from '../../helpers/db';
import { mkAccount, secondUserDomain, setup, snapshot, type TestEnv } from '../domain/_helpers';

const USER_B = 'otro-usuario';

const OWNED_TABLES = [
  'accounts', 'categories', 'debts', 'goals', 'recurring_items', 'transactions', 'goal_contributions', 'balance_adjustments',
] as const;

/** Las 12 referencias entre tablas con dueno: [tabla hija, columna, tabla padre]. */
const REFERENCES = [
  ['recurring_items', 'debt_id', 'debts'],
  ['recurring_items', 'category_id', 'categories'],
  ['recurring_items', 'default_account_id', 'accounts'],
  ['transactions', 'account_id', 'accounts'],
  ['transactions', 'category_id', 'categories'],
  ['transactions', 'debt_id', 'debts'],
  ['transactions', 'recurring_item_id', 'recurring_items'],
  ['goal_contributions', 'goal_id', 'goals'],
  ['goal_contributions', 'account_id', 'accounts'],
  ['balance_adjustments', 'account_id', 'accounts'],
  ['balance_adjustments', 'debt_id', 'debts'],
  ['balance_adjustments', 'goal_id', 'goals'],
] as const;

type Parent = (typeof REFERENCES)[number][2];

/** Datos de un usuario con filas en las 8 tablas y en las 12 referencias. Devuelve un id propio por tabla padre. */
function populate(d: Domain, tag: string): Record<Parent, string> {
  const acc = mkAccount(d, `Cuenta ${tag}`, 1_000_000);
  d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 100, newCategoryName: `Cat ${tag}` });
  const cat = d.transactions.categories('EXPENSE').find((c) => c.userId !== null)!.id;
  const debt = d.debts.create({
    name: `Deuda ${tag}`, balanceMinor: 500_000, installmentMinor: 50_000, rate: { known: 0.02 }, nextDueDate: '2026-04-01',
  }).result;
  d.debts.registerPayment({ debtId: debt.id, accountId: acc, amountMinor: 50_000, type: 'INSTALLMENT' });
  const goal = d.goals.create({ name: `Meta ${tag}`, targetMinor: 100_000 }).result.id;
  d.goals.contribute({ goalId: goal, accountId: acc, amountMinor: 30_000 });
  d.goals.update(goal, { savedMinor: 45_000 });
  const rec = d.recurring.create({
    type: 'EXPENSE', name: `Renta ${tag}`, amountMinor: 1_000, frequency: 'MONTHLY', anchorDate: '2026-02-15',
    categoryId: cat, defaultAccountId: acc,
  }).result.id;
  d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-02-15', accountId: acc });
  return { accounts: acc, categories: cat, debts: debt.id, goals: goal, recurring_items: rec };
}

interface World {
  env: TestEnv;
  b: Record<Parent, string>;
}

function world(): World {
  const env = setup();
  populate(env.d, 'A');
  const b = populate(secondUserDomain(env, USER_B), 'B');
  return { env, b };
}

/** Una fila de A en `table` con `col` no nula (el mundo garantiza que existe). */
function rowOfA(w: World, table: string, col: string): string {
  const id = w.env.sqlite
    .prepare(`select id from ${table} where user_id = ? and ${col} is not null limit 1`)
    .pluck()
    .get(DEFAULT_USER_ID) as string | undefined;
  expect(id, `el mundo debe tener una fila de A en ${table}.${col}`).toBeDefined();
  return id!;
}

/** INSERT que copia la fila `id` de `table` con otro id y `col = value`. */
function insertCopy(w: World, table: string, id: string, col: string, value: string): void {
  const cols = (w.env.sqlite.prepare(`pragma table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  const select = cols.map((c) => (c === 'id' ? "'copia-' || id" : c === col ? '?' : c)).join(', ');
  w.env.sqlite.prepare(`insert into ${table} (${cols.join(', ')}) select ${select} from ${table} where id = ?`).run(value, id);
}

describe('triggers de propietario: instalados', () => {
  it('existen los 24 triggers (8 de user_id inmutable, 8 anti-REPLACE, 4 tablas hijas x INSERT/UPDATE)', () => {
    const env = setup();
    const names = (env.sqlite.prepare("select name from sqlite_master where type = 'trigger' order by name").pluck().all() as string[]);
    const expected = [
      ...OWNED_TABLES.map((t) => `trg_${t}_user_id_immutable`),
      ...OWNED_TABLES.map((t) => `trg_${t}_owner_replace`),
      ...['recurring_items', 'transactions', 'goal_contributions', 'balance_adjustments'].flatMap((t) => [
        `trg_${t}_owner_ins`, `trg_${t}_owner_upd`,
      ]),
    ].sort();
    expect(names).toEqual(expected);
  });
});

describe('triggers de propietario: una referencia a una fila de OTRO usuario se rechaza', () => {
  it.each(REFERENCES)('UPDATE %s.%s hacia una fila de B -> OWNER_MISMATCH sin efectos', (table, col, parent) => {
    const w = world();
    const id = rowOfA(w, table, col);
    const before = snapshot(w.env);
    expect(() => w.env.sqlite.prepare(`update ${table} set ${col} = ? where id = ?`).run(w.b[parent], id)).toThrow(
      `OWNER_MISMATCH: ${table}.${col}`,
    );
    expect(snapshot(w.env)).toBe(before);
  });

  it.each(REFERENCES)('INSERT en %s con %s de B y user_id de A -> OWNER_MISMATCH sin efectos', (table, col, parent) => {
    const w = world();
    const id = rowOfA(w, table, col);
    const before = snapshot(w.env);
    expect(() => insertCopy(w, table, id, col, w.b[parent])).toThrow(`OWNER_MISMATCH: ${table}.${col}`);
    expect(snapshot(w.env)).toBe(before);
  });

  it.each(REFERENCES)('%s.%s hacia un id INEXISTENTE sigue siendo un error de FK (el trigger no lo enmascara)', (table, col) => {
    const w = world();
    const id = rowOfA(w, table, col);
    expect(() => w.env.sqlite.prepare(`update ${table} set ${col} = 'no-existe' where id = ?`).run(id)).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it.each(REFERENCES)('control positivo: %s.%s hacia una fila PROPIA se acepta', (table, col) => {
    const w = world();
    const id = rowOfA(w, table, col);
    expect(() => w.env.sqlite.prepare(`update ${table} set ${col} = ${col} where id = ?`).run(id)).not.toThrow();
  });

  it('una categoria del SISTEMA (user_id NULL) se acepta desde cualquier usuario (UPDATE e INSERT)', () => {
    const w = world();
    const system = w.env.sqlite
      .prepare("select id from categories where user_id is null and type = 'EXPENSE' limit 1")
      .pluck()
      .get() as string;
    for (const table of ['transactions', 'recurring_items']) {
      const id = rowOfA(w, table, 'category_id');
      expect(() => w.env.sqlite.prepare(`update ${table} set category_id = ? where id = ?`).run(system, id)).not.toThrow();
    }
    const tx = rowOfA(w, 'transactions', 'category_id');
    expect(() => insertCopy(w, 'transactions', tx, 'category_id', system)).not.toThrow();
  });

  it('una fila PREVIA incoherente no bloquea editar otra columna ni el SET NULL de un borrado', () => {
    // Fila heredada (anterior a 0001) con transactions.account_id de B: se fabrica quitando y reponiendo el trigger.
    const w = world();
    const db = w.env.sqlite;
    const tx = rowOfA(w, 'transactions', 'category_id');
    const ddl = db.prepare("select sql from sqlite_master where name = 'trg_transactions_owner_upd'").pluck().get() as string;
    db.exec('drop trigger trg_transactions_owner_upd');
    db.prepare('update transactions set account_id = ? where id = ?').run(w.b.accounts, tx);
    db.exec(ddl);
    expect(() => db.prepare('update transactions set category_id = null where id = ?').run(tx)).not.toThrow();
    expect(() => db.prepare('update transactions set account_id = account_id where id = ?').run(tx)).not.toThrow();
  });
});

describe('triggers de propietario: user_id no se puede reasignar', () => {
  it.each(OWNED_TABLES)('UPDATE %s.user_id hacia un usuario EXISTENTE -> OWNER_IMMUTABLE sin efectos', (table) => {
    const w = world();
    const id = w.env.sqlite.prepare(`select id from ${table} where user_id = ? limit 1`).pluck().get(DEFAULT_USER_ID) as string;
    expect(id).toBeDefined();
    const before = snapshot(w.env);
    expect(() => w.env.sqlite.prepare(`update ${table} set user_id = ? where id = ?`).run(USER_B, id)).toThrow(
      `OWNER_IMMUTABLE: ${table}.user_id`,
    );
    expect(snapshot(w.env)).toBe(before);
  });

  it.each(OWNED_TABLES)('INSERT OR REPLACE en %s con el id de una fila de A y user_id de B -> OWNER_IMMUTABLE sin efectos', (table) => {
    const w = world();
    const id = w.env.sqlite.prepare(`select id from ${table} where user_id = ? limit 1`).pluck().get(DEFAULT_USER_ID) as string;
    const cols = (w.env.sqlite.prepare(`pragma table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    const q = (c: string) => `"${c}"`;
    const select = cols.map((c) => (c === 'user_id' ? '?' : q(c))).join(', ');
    // En las tablas hijas salta antes OWNER_MISMATCH (sus referencias siguen siendo de A): tambien rechaza.
    const expected = ['accounts', 'categories', 'debts', 'goals'].includes(table)
      ? `OWNER_IMMUTABLE: ${table}.user_id`
      : /OWNER_(IMMUTABLE|MISMATCH): /;
    const before = snapshot(w.env);
    expect(() =>
      w.env.sqlite
        .prepare(`insert or replace into ${table} (${cols.map(q).join(', ')}) select ${select} from ${table} where id = ?`)
        .run(USER_B, id),
    ).toThrow(expected);
    expect(snapshot(w.env)).toBe(before);
  });

  it('asignar el MISMO user_id (sin cambio real) se acepta', () => {
    const w = world();
    const id = rowOfA(w, 'accounts', 'user_id');
    expect(() => w.env.sqlite.prepare('update accounts set user_id = user_id where id = ?').run(id)).not.toThrow();
  });
});

describe('triggers de propietario: los ON DELETE existentes no cambian', () => {
  it('SET NULL (default_account_id, recurring_item_id) y CASCADE (ajustes) siguen funcionando', () => {
    const w = world();
    const db = w.env.sqlite;
    // Cuenta sin movimientos usada solo como predeterminada de un recurrente.
    const acc = mkAccount(w.env.d, 'Solo predeterminada', 5_000);
    const rec = w.env.d.recurring.create({
      type: 'EXPENSE', name: 'Con cuenta', amountMinor: 10, frequency: 'MONTHLY', anchorDate: '2026-03-01', defaultAccountId: acc,
    }).result.id;
    db.prepare('delete from accounts where id = ?').run(acc);
    expect(db.prepare('select default_account_id from recurring_items where id = ?').pluck().get(rec)).toBeNull();
    expect(db.prepare("select count(*) from balance_adjustments where account_id = ?").pluck().get(acc)).toBe(0);

    const recWithTx = rowOfA(w, 'transactions', 'recurring_item_id');
    const recId = db.prepare('select recurring_item_id from transactions where id = ?').pluck().get(recWithTx) as string;
    db.prepare('delete from recurring_items where id = ?').run(recId);
    expect(db.prepare('select recurring_item_id from transactions where id = ?').pluck().get(recWithTx)).toBeNull();
    expect(db.prepare('pragma foreign_key_check').all()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Actualizacion de una BD existente: 0000 con datos -> 0001.
// ---------------------------------------------------------------------------------------------

/** Copia de las migraciones con el journal recortado a las `n` primeras (en un directorio temporal). */
function migrationsUpTo(n: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-migrations-'));
  fs.cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta/_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, n);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('migracion 0001 sobre una BD con datos (usuario que actualiza la app)', () => {
  it('no cambia ningun dato, no deja violaciones de FK y activa los triggers', () => {
    const old = migrationsUpTo(1);
    tmpDirs.push(old);
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: old });
    expect(sqlite.prepare("select count(*) from sqlite_master where type = 'trigger'").pluck().get()).toBe(0);

    seedDatabase(db);
    const clock = { now: new Date(2026, 2, 10, 12).getTime() };
    const env: TestEnv = { d: createDomain(db, { now: () => clock.now }), db, sqlite, clock };
    populate(env.d, 'A');
    const before = snapshot(env);
    expect(sqlite.prepare('select count(*) from transactions').pluck().get()).toBeGreaterThan(0);

    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    expect(snapshot(env)).toBe(before);
    expect(sqlite.prepare('select count(*) from __drizzle_migrations').pluck().get()).toBe(2);
    expect(sqlite.prepare("select count(*) from sqlite_master where type = 'trigger'").pluck().get()).toBe(24);
    expect(sqlite.prepare('pragma foreign_key_check').all()).toEqual([]);
    expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok');

    // Tras actualizar, la app sigue operando y los triggers ya protegen los datos viejos.
    const acc = sqlite.prepare('select id from accounts limit 1').pluck().get() as string;
    expect(() => env.d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 1 })).not.toThrow();
    sqlite.prepare('insert into users (id, created_at, updated_at) values (?, 0, 0)').run(USER_B);
    expect(() => sqlite.prepare('update accounts set user_id = ? where id = ?').run(USER_B, acc)).toThrow('OWNER_IMMUTABLE');
    sqlite.close();
  });
});
