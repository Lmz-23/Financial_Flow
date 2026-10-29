import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as s from '../../../src/database/schema';
import { createTestDb, type TestDb } from '../../helpers/db';
import {
  expectFails, FK_FAIL, mkAccount, mkDebt, mkGoal, mkRecurring, mkTx, seedUser, UNIQUE_FAIL, USER,
} from './_fixtures';

let t: TestDb;
beforeEach(() => {
  t = createTestDb();
  seedUser(t.db);
});
afterEach(() => t.close());

const d = new Date('2026-01-15T12:00:00Z');

// -----------------------------------------------------------------------------
describe('users', () => {
  it('valores por defecto: COP, system, avisos activos, 9h, widgets NULL', () => {
    const u = t.db.select().from(s.users).where(eq(s.users.id, USER)).get()!;
    expect(u).toMatchObject({
      currency: 'COP', themePreference: 'system', notifyPaymentReminders: true,
      notifyWeeklySummary: true, reminderHour: 9,
      widgetCashflow: null, widgetDebts: null, widgetGoals: null, onboardingCompletedAt: null,
    });
  });
  it('widgets: NULL, 0 y 1 pasan; otros valores fallan', () => {
    for (const v of [null, 0, 1]) {
      expect(() => t.db.update(s.users).set({ widgetCashflow: v, widgetDebts: v, widgetGoals: v }).run()).not.toThrow();
    }
    expectFails(() => t.db.update(s.users).set({ widgetCashflow: 2 }).run(), 'ck_users_widget_cashflow');
    expectFails(() => t.db.update(s.users).set({ widgetDebts: -1 }).run(), 'ck_users_widget_debts');
    expectFails(() => t.db.update(s.users).set({ widgetGoals: 5 }).run(), 'ck_users_widget_goals');
  });
  it('themePreference y reminderHour', () => {
    expectFails(
      () => t.sqlite.prepare("UPDATE users SET theme_preference = 'sepia'").run(), 'ck_users_theme');
    expect(() => t.db.update(s.users).set({ themePreference: 'dark' }).run()).not.toThrow();
    expectFails(() => t.db.update(s.users).set({ reminderHour: 24 }).run(), 'ck_users_reminder_hour');
    expectFails(() => t.db.update(s.users).set({ reminderHour: -1 }).run(), 'ck_users_reminder_hour');
    expect(() => t.db.update(s.users).set({ reminderHour: 23 }).run()).not.toThrow();
  });
  it('RESTRICT: no se puede borrar un usuario con cuentas', () => {
    mkAccount(t.db);
    expectFails(() => t.db.delete(s.users).where(eq(s.users.id, USER)).run(), FK_FAIL);
  });
});

// -----------------------------------------------------------------------------
describe('accounts', () => {
  it('type: solo los 4 del diseño', () => {
    for (const type of ['CASH', 'SAVINGS', 'CHECKING', 'DIGITAL_WALLET'] as const) {
      expect(() => mkAccount(t.db, { type })).not.toThrow();
    }
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO accounts (id,user_id,name,type,created_at,updated_at) VALUES ('x','u1','n','INVESTMENT',0,0)").run(),
      'ck_accounts_type');
  });
  it('userId inexistente falla', () => {
    expectFails(() => mkAccount(t.db, { userId: 'nadie' }), FK_FAIL);
  });
  it('RESTRICT: no se puede borrar una cuenta con aportes a metas', () => {
    const acc = mkAccount(t.db);
    const goal = mkGoal(t.db);
    t.db.insert(s.goalContributions).values({ userId: USER, goalId: goal, accountId: acc, amountMinor: 10, date: d }).run();
    expectFails(() => t.db.delete(s.accounts).where(eq(s.accounts.id, acc)).run(), FK_FAIL);
  });
  it('SET NULL: borrar la cuenta deja defaultAccountId NULL en el recurrente', () => {
    const acc = mkAccount(t.db);
    const rec = mkRecurring(t.db, { defaultAccountId: acc });
    t.db.delete(s.accounts).where(eq(s.accounts.id, acc)).run();
    expect(t.db.select().from(s.recurringItems).where(eq(s.recurringItems.id, rec)).get()?.defaultAccountId).toBeNull();
  });
  it('CASCADE: borrar una cuenta sin movimientos borra sus ajustes', () => {
    const acc = mkAccount(t.db);
    t.db.insert(s.balanceAdjustments).values({
      userId: USER, targetType: 'ACCOUNT', accountId: acc, previousMinor: 0, newMinor: 500, deltaMinor: 500, reason: 'OPENING',
    }).run();
    t.db.delete(s.accounts).where(eq(s.accounts.id, acc)).run();
    expect(t.db.select().from(s.balanceAdjustments).all()).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
describe('categories', () => {
  const cat = (over: Partial<s.NewCategory>) => () =>
    t.db.insert(s.categories).values({ userId: USER, name: 'Comida', type: 'EXPENSE', ...over }).run();

  it('UNIQUE(userId,type,name) para categorias de usuario', () => {
    cat({})();
    expectFails(cat({}), UNIQUE_FAIL);
    expect(cat({ type: 'INCOME' })).not.toThrow(); // mismo nombre, otro tipo
    expect(cat({ name: 'Otro' })).not.toThrow();
  });
  it('UNIQUE parcial para las del sistema (userId NULL): NULL no evita duplicados por si solo', () => {
    cat({ userId: null })();
    expectFails(cat({ userId: null }), UNIQUE_FAIL);
    expect(cat({ userId: null, type: 'INCOME' })).not.toThrow();
  });
  it('type solo INCOME/EXPENSE', () => {
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO categories (id,name,type,created_at) VALUES ('c','n','TRANSFER',0)").run(), 'ck_categories_type');
  });
  it('CASCADE: borrar el usuario no es posible con datos, pero sus categorias se borran si solo tiene categorias', () => {
    cat({})();
    t.db.delete(s.users).where(eq(s.users.id, USER)).run();
    expect(t.db.select().from(s.categories).all()).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
describe('debts', () => {
  const debt = (over: Partial<s.NewDebt>) => () =>
    t.db.insert(s.debts).values({ userId: USER, name: 'D', rateSource: 'KNOWN', ...over }).run();

  it('pasa con valores nulos opcionales', () => {
    expect(debt({})).not.toThrow();
    expect(debt({ installmentMinor: 100, monthlyRate: 0.02, totalCount: 12, initialPaidCount: 3 })).not.toThrow();
  });
  it('installmentMinor > 0 si existe', () => {
    expectFails(debt({ installmentMinor: 0 }), 'ck_debts_installment');
    expectFails(debt({ installmentMinor: -1 }), 'ck_debts_installment');
  });
  it('monthlyRate >= 0', () => {
    expectFails(debt({ monthlyRate: -0.01 }), 'ck_debts_rate');
    expect(debt({ monthlyRate: 0 })).not.toThrow();
  });
  it('rateSource enum', () => {
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO debts (id,user_id,name,rate_source,created_at,updated_at) VALUES ('x','u1','n','MAYBE',0,0)").run(),
      'ck_debts_rate_source');
  });
  it('initialPaidCount >= 0 y totalCount > 0', () => {
    expectFails(debt({ initialPaidCount: -1 }), 'ck_debts_initial_paid');
    expectFails(debt({ totalCount: 0 }), 'ck_debts_total_count');
  });
  it('CASCADE: borrar una deuda sin pagos borra sus ajustes; RESTRICT con recurrente vinculado', () => {
    const id = mkDebt(t.db);
    t.db.insert(s.balanceAdjustments).values({
      userId: USER, targetType: 'DEBT', debtId: id, previousMinor: 0, newMinor: 900, deltaMinor: 900, reason: 'OPENING',
    }).run();
    mkRecurring(t.db, { kind: 'DEBT_INSTALLMENT', debtId: id, name: null, amountMinor: null });
    expectFails(() => t.db.delete(s.debts).where(eq(s.debts.id, id)).run(), FK_FAIL);
    t.db.delete(s.recurringItems).where(eq(s.recurringItems.debtId, id)).run();
    t.db.delete(s.debts).where(eq(s.debts.id, id)).run();
    expect(t.db.select().from(s.balanceAdjustments).all()).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
describe('goals', () => {
  const goal = (over: Partial<s.NewGoal>) => () =>
    t.db.insert(s.goals).values({ userId: USER, name: 'G', targetMinor: 1000, ...over }).run();

  it('targetMinor > 0', () => {
    expectFails(goal({ targetMinor: 0 }), 'ck_goals_target');
    expect(goal({})).not.toThrow();
  });
  it("status='SPENT' <=> spentAt y spentAmountMinor no nulos", () => {
    expect(goal({ status: 'SPENT', spentAt: d, spentAmountMinor: 1000 })).not.toThrow();
    expectFails(goal({ status: 'SPENT' }), 'ck_goals_spent_fields');
    expectFails(goal({ status: 'SPENT', spentAt: d }), 'ck_goals_spent_fields');
    expectFails(goal({ status: 'SPENT', spentAmountMinor: 5 }), 'ck_goals_spent_fields');
    expectFails(goal({ status: 'ACTIVE', spentAt: d, spentAmountMinor: 5 }), 'ck_goals_spent_fields');
    expectFails(goal({ status: 'ACTIVE', spentAt: d }), 'ck_goals_spent_fields');
  });
  it('cerrar una meta (UPDATE ACTIVE -> SPENT) exige ambos campos', () => {
    const id = mkGoal(t.db);
    expectFails(() => t.db.update(s.goals).set({ status: 'SPENT' }).where(eq(s.goals.id, id)).run(), 'ck_goals_spent_fields');
    expect(() => t.db.update(s.goals).set({ status: 'SPENT', spentAt: d, spentAmountMinor: 1000 }).where(eq(s.goals.id, id)).run()).not.toThrow();
  });
  it('status enum y spentAmountMinor >= 0', () => {
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO goals (id,user_id,name,target_minor,status,created_at,updated_at) VALUES ('x','u1','n',5,'DONE',0,0)").run(),
      'ck_goals_status');
    expectFails(goal({ status: 'SPENT', spentAt: d, spentAmountMinor: -1 }), 'ck_goals_spent_amount');
  });
});

// -----------------------------------------------------------------------------
describe('goal_contributions', () => {
  let acc: string;
  let goal: string;
  beforeEach(() => { acc = mkAccount(t.db); goal = mkGoal(t.db); });
  const contrib = (over: Partial<s.NewGoalContribution> = {}) => () =>
    t.db.insert(s.goalContributions).values({ userId: USER, goalId: goal, accountId: acc, amountMinor: 100, date: d, ...over }).run();

  it('amountMinor > 0', () => {
    expectFails(contrib({ amountMinor: 0 }), 'ck_contrib_amount');
    expect(contrib()).not.toThrow();
  });
  it('FK a meta y cuenta existentes', () => {
    expectFails(contrib({ goalId: 'nope' }), FK_FAIL);
    expectFails(contrib({ accountId: 'nope' }), FK_FAIL);
  });
  it('RESTRICT: no se puede borrar una meta con aportes (hay que borrar los aportes primero)', () => {
    contrib()();
    expectFails(() => t.db.delete(s.goals).where(eq(s.goals.id, goal)).run(), FK_FAIL);
    t.db.delete(s.goalContributions).where(eq(s.goalContributions.goalId, goal)).run();
    expect(() => t.db.delete(s.goals).where(eq(s.goals.id, goal)).run()).not.toThrow();
  });
});

// -----------------------------------------------------------------------------
describe('balance_adjustments', () => {
  let acc: string;
  let debt: string;
  let goal: string;
  beforeEach(() => { acc = mkAccount(t.db); debt = mkDebt(t.db); goal = mkGoal(t.db); });

  const adj = (over: Partial<s.NewBalanceAdjustment>) => () =>
    t.db.insert(s.balanceAdjustments).values({
      userId: USER, targetType: 'ACCOUNT', accountId: acc, previousMinor: 0, newMinor: 100, deltaMinor: 100, reason: 'MANUAL', ...over,
    }).run();

  it('exactamente un FK y que coincida con targetType', () => {
    expect(adj({})).not.toThrow();
    expect(adj({ targetType: 'DEBT', accountId: null, debtId: debt })).not.toThrow();
    expect(adj({ targetType: 'GOAL', accountId: null, goalId: goal })).not.toThrow();
    // ningun FK
    expectFails(adj({ accountId: null }), 'ck_adj_single_target');
    // dos FK
    expectFails(adj({ debtId: debt }), 'ck_adj_single_target');
    // FK que no coincide con targetType
    expectFails(adj({ targetType: 'DEBT', accountId: acc }), 'ck_adj_single_target');
    expectFails(adj({ targetType: 'GOAL', accountId: null, debtId: debt }), 'ck_adj_single_target');
  });
  it('deltaMinor = newMinor - previousMinor', () => {
    expectFails(adj({ previousMinor: 50, newMinor: 100, deltaMinor: 100 }), 'ck_adj_delta');
    expect(adj({ previousMinor: 50, newMinor: 100, deltaMinor: 50 })).not.toThrow();
    expect(adj({ previousMinor: 100, newMinor: 30, deltaMinor: -70 })).not.toThrow();
  });
  it('newMinor >= 0 salvo cuentas', () => {
    expect(adj({ previousMinor: 0, newMinor: -500, deltaMinor: -500 })).not.toThrow(); // cuenta negativa OK
    expectFails(adj({ targetType: 'DEBT', accountId: null, debtId: debt, newMinor: -1, deltaMinor: -1 }), 'ck_adj_non_negative');
    expectFails(adj({ targetType: 'GOAL', accountId: null, goalId: goal, newMinor: -1, deltaMinor: -1 }), 'ck_adj_non_negative');
  });
  it('enums targetType y reason', () => {
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO balance_adjustments (id,user_id,target_type,previous_minor,new_minor,delta_minor,reason,created_at) VALUES ('x','u1','POCKET',0,0,0,'MANUAL',0)").run(),
      'ck_adj_target_type');
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO balance_adjustments (id,user_id,target_type,account_id,previous_minor,new_minor,delta_minor,reason,created_at) VALUES ('y','u1','ACCOUNT',?,0,0,0,'WHIM',0)").run(acc),
      'ck_adj_reason');
  });
  it('FK inexistente falla', () => {
    expectFails(adj({ accountId: 'nope' }), FK_FAIL);
  });
  it('CASCADE: borrar una meta sin aportes borra sus ajustes', () => {
    adj({ targetType: 'GOAL', accountId: null, goalId: goal })();
    t.db.delete(s.goals).where(eq(s.goals.id, goal)).run();
    expect(t.db.select().from(s.balanceAdjustments).all()).toHaveLength(0);
  });
  it('una cuenta con transacciones sigue protegida aunque tenga ajustes (RESTRICT de transactions)', () => {
    adj({})();
    mkTx(t.db, acc);
    expectFails(() => t.db.delete(s.accounts).where(eq(s.accounts.id, acc)).run(), FK_FAIL);
    expect(t.db.select().from(s.balanceAdjustments).all()).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
describe('recurring_items', () => {
  const rec = (over: Partial<s.NewRecurringItem>) => () =>
    t.db.insert(s.recurringItems).values({
      userId: USER, type: 'EXPENSE', name: 'Netflix', amountMinor: 100, frequency: 'MONTHLY', ...over,
    }).run();
  const debtRec = (debtId: string, over: Partial<s.NewRecurringItem> = {}) =>
    rec({ kind: 'DEBT_INSTALLMENT', debtId, name: null, amountMinor: null, ...over });

  it('STANDARD valido pasa; exige amountMinor > 0 y name', () => {
    expect(rec({})).not.toThrow();
    expectFails(rec({ amountMinor: 0 }), 'ck_rec_standard');
    expectFails(rec({ amountMinor: null }), 'ck_rec_standard');
    expectFails(rec({ name: null }), 'ck_rec_standard');
  });
  it('STANDARD no puede tener debtId; DEBT_INSTALLMENT exige debtId', () => {
    const debt = mkDebt(t.db);
    expectFails(rec({ debtId: debt }), 'ck_rec_kind_debt');
    expectFails(rec({ kind: 'DEBT_INSTALLMENT', name: null, amountMinor: null }), 'ck_rec_kind_debt');
    expect(debtRec(debt)).not.toThrow();
  });
  it('DEBT_INSTALLMENT: solo EXPENSE, sin amountMinor ni name', () => {
    const debt = mkDebt(t.db);
    expectFails(debtRec(debt, { type: 'INCOME' }), 'ck_rec_debt_installment');
    expectFails(debtRec(debt, { amountMinor: 5 }), 'ck_rec_debt_installment');
    expectFails(debtRec(debt, { name: 'x' }), 'ck_rec_debt_installment');
  });
  it('debtId UNIQUE: una sola cuota recurrente por deuda', () => {
    const debt = mkDebt(t.db);
    debtRec(debt)();
    expectFails(debtRec(debt), UNIQUE_FAIL);
    expect(debtRec(mkDebt(t.db))).not.toThrow();
    // varios STANDARD (debtId NULL) no chocan
    rec({})();
    expect(rec({})).not.toThrow();
  });
  it('isPassive solo con INCOME', () => {
    expectFails(rec({ type: 'EXPENSE', isPassive: true }), 'ck_rec_passive_income');
    expect(rec({ type: 'INCOME', isPassive: true })).not.toThrow();
  });
  it('frequency: WEEKLY/BIWEEKLY/MONTHLY; ANNUAL ya no existe', () => {
    for (const frequency of ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const) expect(rec({ frequency })).not.toThrow();
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO recurring_items (id,user_id,type,kind,name,amount_minor,frequency,status,created_at,updated_at) VALUES ('z','u1','EXPENSE','STANDARD','n',5,'ANNUAL','ACTIVE',0,0)").run(),
      'ck_rec_frequency');
  });
  it('status solo ACTIVE/PAUSED', () => {
    expect(rec({ status: 'PAUSED' })).not.toThrow();
    expectFails(() => t.sqlite.prepare(
      "INSERT INTO recurring_items (id,user_id,type,kind,name,amount_minor,frequency,status,created_at,updated_at) VALUES ('z','u1','EXPENSE','STANDARD','n',5,'MONTHLY','PENDING_PAYMENT',0,0)").run(),
      'ck_rec_status');
  });
  it('anchorDate/nextDueDate: YYYY-MM-DD o NULL', () => {
    expect(rec({ anchorDate: '2026-01-31', nextDueDate: '2026-02-28' })).not.toThrow();
    expect(rec({ anchorDate: null, nextDueDate: null })).not.toThrow();
    expectFails(rec({ nextDueDate: '2026-1-5' }), 'ck_rec_next_due_date');
    expectFails(rec({ anchorDate: 'hoy' }), 'ck_rec_anchor_date');
  });
  it('FK de categoryId/defaultAccountId inexistentes fallan; SET NULL al borrar la categoria', () => {
    expectFails(rec({ categoryId: 'nope' }), FK_FAIL);
    expectFails(rec({ defaultAccountId: 'nope' }), FK_FAIL);
    const cat = 'c1';
    t.db.insert(s.categories).values({ id: cat, userId: USER, name: 'X', type: 'EXPENSE' }).run();
    const id = mkRecurring(t.db, { categoryId: cat });
    t.db.delete(s.categories).where(eq(s.categories.id, cat)).run();
    expect(t.db.select().from(s.recurringItems).where(eq(s.recurringItems.id, id)).get()?.categoryId).toBeNull();
  });
});

// -----------------------------------------------------------------------------
describe('ids y tiempos por defecto', () => {
  it('las filas sin id explicito reciben un UUID v4 unico y createdAt/updatedAt', () => {
    t.db.insert(s.accounts).values({ userId: USER, name: 'A', type: 'CASH' }).run();
    t.db.insert(s.accounts).values({ userId: USER, name: 'B', type: 'CASH' }).run();
    const rows = t.db.select().from(s.accounts).all();
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(r.createdAt).toBeInstanceOf(Date);
    }
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});
