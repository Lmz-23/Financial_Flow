import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as s from '../../../src/database/schema';
import { createTestDb, type TestDb } from '../../helpers/db';
import {
  expectFails, FK_FAIL, mkAccount, mkCategory, mkDebt, mkRecurring, mkTx, seedUser, txValues, UNIQUE_FAIL,
} from './_fixtures';

let t: TestDb;
let acc: string;
beforeEach(() => {
  t = createTestDb();
  seedUser(t.db);
  acc = mkAccount(t.db);
});
afterEach(() => t.close());

const insert = (over: Partial<s.NewTransaction>) => () => t.db.insert(s.transactions).values(txValues(acc, over)).run();

describe('transactions: CHECK', () => {
  it('amountMinor > 0', () => {
    expectFails(insert({ amountMinor: 0 }), 'ck_tx_amount');
    expectFails(insert({ amountMinor: -5 }), 'ck_tx_amount');
    expect(() => insert({ amountMinor: 1 })()).not.toThrow();
  });

  it('type y kind solo aceptan sus valores', () => {
    const raw = (type: string, kind: string) => () =>
      t.sqlite
        .prepare(
          `INSERT INTO transactions (id,user_id,account_id,type,kind,amount_minor,description,date,created_at,updated_at)
           VALUES (?,?,?,?,?,1,'',0,0,0)`,
        )
        .run(`raw_${type}_${kind}`, 'u1', acc, type, kind);
    expectFails(raw('TRANSFER', 'STANDARD'), 'ck_tx_type');
    expectFails(raw('EXPENSE', 'OTHER'), 'ck_tx_kind');
    expect(raw('INCOME', 'STANDARD')).not.toThrow();
  });

  it('isPassive=1 solo con INCOME', () => {
    expectFails(insert({ type: 'EXPENSE', isPassive: true }), 'ck_tx_passive_income');
    expect(() => insert({ type: 'INCOME', isPassive: true })()).not.toThrow();
    expect(() => insert({ type: 'EXPENSE', isPassive: false })()).not.toThrow();
  });

  describe('coherencia de kind=DEBT_PAYMENT', () => {
    let debt: string;
    beforeEach(() => { debt = mkDebt(t.db); });
    const valid = () => ({
      kind: 'DEBT_PAYMENT' as const, type: 'EXPENSE' as const, debtId: debt,
      debtPaymentType: 'INSTALLMENT' as const, debtPrincipalAppliedMinor: 1000,
    });

    it('pasa con EXPENSE y los tres campos', () => {
      expect(() => insert(valid())()).not.toThrow();
    });
    it('falla si es INCOME', () => {
      expectFails(insert({ ...valid(), type: 'INCOME' }), 'ck_tx_debt_payment');
    });
    it('falla sin debtId, sin debtPaymentType o sin principal', () => {
      expectFails(insert({ ...valid(), debtId: null }), 'ck_tx_debt_payment');
      expectFails(insert({ ...valid(), debtPaymentType: null }), 'ck_tx_debt_payment');
      expectFails(insert({ ...valid(), debtPrincipalAppliedMinor: null }), 'ck_tx_debt_payment');
    });
    it('STANDARD no puede traer campos de deuda', () => {
      expectFails(insert({ kind: 'STANDARD', debtId: debt }), 'ck_tx_standard_no_debt');
      expectFails(insert({ kind: 'STANDARD', debtPaymentType: 'EXTRA' }), 'ck_tx_standard_no_debt');
      expectFails(insert({ kind: 'STANDARD', debtPrincipalAppliedMinor: 0 }), 'ck_tx_standard_no_debt');
      expect(() => insert({ kind: 'STANDARD' })()).not.toThrow();
    });
    it('debtPaymentType solo INSTALLMENT/EXTRA', () => {
      expectFails(
        () =>
          t.sqlite
            .prepare(
              `INSERT INTO transactions (id,user_id,account_id,type,kind,amount_minor,description,date,debt_id,debt_payment_type,debt_principal_applied_minor,created_at,updated_at)
               VALUES ('c','u1',?,'EXPENSE','DEBT_PAYMENT',5,'',0,?,'OTRO',1,0,0)`,
            )
            .run(acc, debt),
        'ck_tx_payment_type',
      );
      expect(() => insert({ ...valid(), debtPaymentType: 'EXTRA' })()).not.toThrow();
    });
    it('debtPrincipalAppliedMinor entre 0 y amountMinor', () => {
      expectFails(insert({ ...valid(), amountMinor: 1000, debtPrincipalAppliedMinor: 1001 }), 'ck_tx_principal_range');
      expectFails(insert({ ...valid(), debtPrincipalAppliedMinor: -1 }), 'ck_tx_principal_range');
      expect(() => insert({ ...valid(), amountMinor: 1000, debtPrincipalAppliedMinor: 0 })()).not.toThrow();
      expect(() => insert({ ...valid(), amountMinor: 1000, debtPrincipalAppliedMinor: 1000 })()).not.toThrow();
    });
  });

  it('occurrenceDate: formato YYYY-MM-DD y obligatoria con recurringItemId', () => {
    const rec = mkRecurring(t.db);
    expectFails(insert({ recurringItemId: rec, occurrenceDate: null }), 'ck_tx_occurrence_required');
    expectFails(insert({ recurringItemId: rec, occurrenceDate: '15/01/2026' }), 'ck_tx_occurrence_date');
    expect(() => insert({ recurringItemId: rec, occurrenceDate: '2026-01-15' })()).not.toThrow();
    expect(() => insert({ occurrenceDate: null })()).not.toThrow();
  });
});

describe('transactions: UNIQUE parcial (recurringItemId, occurrenceDate)', () => {
  it('dos confirmaciones de la misma ocurrencia fallan', () => {
    const rec = mkRecurring(t.db);
    insert({ recurringItemId: rec, occurrenceDate: '2026-02-01' })();
    expectFails(insert({ recurringItemId: rec, occurrenceDate: '2026-02-01' }), UNIQUE_FAIL);
  });
  it('otra ocurrencia, o otro recurrente, pasan', () => {
    const r1 = mkRecurring(t.db);
    const r2 = mkRecurring(t.db);
    insert({ recurringItemId: r1, occurrenceDate: '2026-02-01' })();
    expect(() => insert({ recurringItemId: r1, occurrenceDate: '2026-03-01' })()).not.toThrow();
    expect(() => insert({ recurringItemId: r2, occurrenceDate: '2026-02-01' })()).not.toThrow();
  });
  it('transacciones sin recurringItemId no chocan entre si', () => {
    insert({ occurrenceDate: null })();
    insert({ occurrenceDate: null })();
    insert({ occurrenceDate: '2026-02-01' })();
    expect(() => insert({ occurrenceDate: '2026-02-01' })()).not.toThrow();
    expect(t.db.select().from(s.transactions).all()).toHaveLength(4);
  });
  it('borrar la transaccion libera la ocurrencia', () => {
    const rec = mkRecurring(t.db);
    const id = mkTx(t.db, acc, { recurringItemId: rec, occurrenceDate: '2026-02-01' });
    t.db.delete(s.transactions).where(eq(s.transactions.id, id)).run();
    expect(() => insert({ recurringItemId: rec, occurrenceDate: '2026-02-01' })()).not.toThrow();
  });
});

describe('transactions: FK', () => {
  it('accountId inexistente falla; categoryId y debtId inexistentes tambien', () => {
    expectFails(() => t.db.insert(s.transactions).values(txValues('nope')).run(), FK_FAIL);
    expectFails(insert({ categoryId: 'nope' }), FK_FAIL);
    expectFails(
      insert({ kind: 'DEBT_PAYMENT', debtId: 'nope', debtPaymentType: 'EXTRA', debtPrincipalAppliedMinor: 1 }),
      FK_FAIL,
    );
  });
  it('RESTRICT: no se puede borrar una cuenta con transacciones', () => {
    mkTx(t.db, acc);
    expectFails(() => t.db.delete(s.accounts).where(eq(s.accounts.id, acc)).run(), FK_FAIL);
    expect(t.db.select().from(s.accounts).all()).toHaveLength(1);
  });
  it('RESTRICT: no se puede borrar una deuda con transacciones', () => {
    const debt = mkDebt(t.db);
    mkTx(t.db, acc, {
      kind: 'DEBT_PAYMENT', debtId: debt, debtPaymentType: 'INSTALLMENT', debtPrincipalAppliedMinor: 10,
    });
    expectFails(() => t.db.delete(s.debts).where(eq(s.debts.id, debt)).run(), FK_FAIL);
  });
  it('SET NULL: borrar la categoria deja la transaccion con categoryId NULL', () => {
    const cat = mkCategory(t.db);
    const id = mkTx(t.db, acc, { categoryId: cat });
    t.db.delete(s.categories).where(eq(s.categories.id, cat)).run();
    expect(t.db.select().from(s.transactions).where(eq(s.transactions.id, id)).get()?.categoryId).toBeNull();
  });
  it('SET NULL: borrar el recurrente conserva la transaccion con recurringItemId NULL', () => {
    const rec = mkRecurring(t.db);
    const id = mkTx(t.db, acc, { recurringItemId: rec, occurrenceDate: '2026-02-01' });
    t.db.delete(s.recurringItems).where(eq(s.recurringItems.id, rec)).run();
    const row = t.db.select().from(s.transactions).where(eq(s.transactions.id, id)).get();
    expect(row?.recurringItemId).toBeNull();
    expect(row?.occurrenceDate).toBe('2026-02-01');
  });
  it('una cuenta sin movimientos si se puede borrar', () => {
    const empty = mkAccount(t.db);
    expect(() => t.db.delete(s.accounts).where(eq(s.accounts.id, empty)).run()).not.toThrow();
  });
});

describe('PRAGMA foreign_keys (constancia de por que es necesario)', () => {
  it('con foreign_keys=ON la conexion de prueba lo tiene activo', () => {
    expect(t.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });
  it('SIN el PRAGMA las FK no se aplican: RESTRICT no protege y se aceptan huerfanos', () => {
    const raw = createTestDb();
    try {
      seedUser(raw.db);
      const a = mkAccount(raw.db);
      mkTx(raw.db, a);
      raw.sqlite.pragma('foreign_keys = OFF');

      // Se borra la cuenta con transacciones: con ON seria FK error (probado arriba).
      expect(() => raw.db.delete(s.accounts).where(eq(s.accounts.id, a)).run()).not.toThrow();
      // Y se inserta una transaccion apuntando a una cuenta inexistente.
      expect(() => raw.db.insert(s.transactions).values(txValues('cuenta-fantasma')).run()).not.toThrow();
      expect(raw.sqlite.prepare('PRAGMA foreign_key_check').all().length).toBeGreaterThan(0);
    } finally {
      raw.close();
    }
  });
  it('NOTA: better-sqlite3 se compila con foreign_keys=1 por defecto (expo-sqlite no esta verificado), por eso el PRAGMA explicito importa', async () => {
    // En tests el default ya seria ON y ocultaria un PRAGMA olvidado; en expo-sqlite el default de SQLite
    // (OFF) no esta documentado para v56, asi que client.ts lo activa y verifica explicitamente.
    const { default: Database } = await import('better-sqlite3');
    const c = new Database(':memory:');
    expect(c.pragma('foreign_keys', { simple: true })).toBe(1);
    c.close();
  });
});
