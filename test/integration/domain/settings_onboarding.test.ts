import { describe, expect, it } from 'vitest';
import { OnboardingAlreadyCompletedError, ValidationError } from '../../../src/domain/services';
import type { OnboardingDraft } from '../../../src/domain/services';
import { clearFail, count, expectIntegrity, failOn, localMs, mkAccount, setup, thrown } from './_helpers';

describe('Widgets en tres estados (escenario 9, i)', () => {
  it('NULL al inicio; solo se activan automaticamente desde NULL; apagar pone 0 y se respeta', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 100_000);
    expect(d.settings.get()).toMatchObject({ widgetCashflow: null, widgetDebts: null, widgetGoals: null });

    // Un ingreso NO pasivo o un gasto no activan el widget de flujo.
    d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 10 });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 10 });
    expect(d.settings.get().widgetCashflow).toBeNull();

    // Primera entidad -> 1.
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 10, isPassive: true });
    d.debts.create({ name: 'D', balanceMinor: 10, rate: { known: 0 } });
    d.goals.create({ name: 'G', targetMinor: 10 });
    expect(d.settings.get()).toMatchObject({ widgetCashflow: 1, widgetDebts: 1, widgetGoals: 1 });

    // El usuario apaga -> 0 (sin borrar nada); nuevas entidades NO lo reactivan.
    d.settings.setWidget('cashflow', false);
    d.settings.setWidget('debts', false);
    d.settings.setWidget('goals', false);
    expect(d.settings.get()).toMatchObject({ widgetCashflow: 0, widgetDebts: 0, widgetGoals: 0 });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 10, isPassive: true });
    d.debts.create({ name: 'D2', balanceMinor: 10, rate: { known: 0 } });
    d.goals.create({ name: 'G2', targetMinor: 10 });
    expect(d.settings.get()).toMatchObject({ widgetCashflow: 0, widgetDebts: 0, widgetGoals: 0 });
    expect(d.debts.list()).toHaveLength(2);
    expect(d.goals.list()).toHaveLength(2);

    // Reactivar a mano -> 1.
    d.settings.setWidget('debts', true);
    expect(d.settings.get().widgetDebts).toBe(1);
    expectIntegrity(d);
  });

  it('autoActivate directo: NULL -> 1 una vez; con 0 o 1 no cambia', () => {
    const env = setup();
    const { d } = env;
    const first = d.settings.autoActivate('goals');
    expect(first.result.activated).toBe(true);
    expect(first.effects.refresh).toContain('settings');
    expect(d.settings.autoActivate('goals').result.activated).toBe(false);
    d.settings.setWidget('goals', false);
    const off = d.settings.autoActivate('goals');
    expect(off.result.activated).toBe(false);
    expect(off.effects.refresh).toEqual([]);
    expect(d.settings.get().widgetGoals).toBe(0);
  });

  it('el CHECK de la BD rechaza valores fuera de NULL/0/1 (I6 detectaria cualquier otro)', () => {
    const env = setup();
    expect(() => env.sqlite.prepare('update users set widget_debts = 2').run()).toThrow(/ck_users_widget_debts/);
  });
});

describe('Ajustes', () => {
  it('tema, avisos y hora de aviso con validacion', () => {
    const env = setup();
    const { d } = env;
    d.settings.setTheme('dark');
    d.settings.setNotifications({ notifyPaymentReminders: false, reminderHour: 20 });
    expect(d.settings.get()).toMatchObject({ themePreference: 'dark', notifyPaymentReminders: false, notifyWeeklySummary: true, reminderHour: 20 });
    expect(d.settings.notificationSettings()).toEqual({ reminderHour: 20, notifyPaymentReminders: false, notifyWeeklySummary: true });
    expect(thrown(() => d.settings.setNotifications({ reminderHour: 24 }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.settings.setNotifications({ reminderHour: 8.5 }))).toBeInstanceOf(ValidationError);
    // @ts-expect-error valor fuera del enum
    expect(thrown(() => d.settings.setTheme('azul'))).toBeInstanceOf(ValidationError);
    expect(d.settings.setTheme('light').effects.refresh).toEqual(['settings']);
  });
});

describe('Onboarding atomico (escenario 10, j)', () => {
  const draft = (): OnboardingDraft => ({
    accounts: [
      { name: 'Efectivo', type: 'CASH', openingMinor: 150_000 },
      { name: 'Ahorros', type: 'SAVINGS', openingMinor: 800_000 },
    ],
    recurring: [
      { type: 'INCOME', name: 'Sueldo', amountMinor: 3_000_000, frequency: 'BIWEEKLY', anchorDate: '2026-03-10' },
      { type: 'INCOME', name: 'Arriendo local', amountMinor: 700_000, isPassive: true, frequency: 'MONTHLY' },
      { type: 'EXPENSE', name: 'Internet', amountMinor: 90_000, frequency: 'MONTHLY' },
    ],
    widgets: { cashflow: false, debts: true, goals: false },
  });

  function expectEmpty(env: ReturnType<typeof setup>) {
    expect(count(env, 'accounts')).toBe(0);
    expect(count(env, 'balance_adjustments')).toBe(0);
    expect(count(env, 'recurring_items')).toBe(0);
    expect(env.d.settings.get()).toMatchObject({
      onboardingCompletedAt: null, widgetCashflow: null, widgetDebts: null, widgetGoals: null,
    });
  }

  it('un fallo a mitad (el ultimo insert de recurrentes aborta) no deja NADA', () => {
    const env = setup();
    failOn(env, 'INSERT', 'recurring_items', "WHEN NEW.name = 'Internet'");
    expect(() => env.d.onboarding.complete(draft())).toThrow(/boom/);
    expectEmpty(env);
    clearFail(env, 'INSERT', 'recurring_items');
    expect(env.d.onboarding.complete(draft()).result.accountIds).toHaveLength(2);
  });

  it('un fallo de regla (monto 0) tras crear las cuentas tampoco deja nada', () => {
    const env = setup();
    const bad = draft();
    bad.recurring.push({ type: 'EXPENSE', name: 'Roto', amountMinor: 0, frequency: 'MONTHLY' });
    expect(thrown(() => env.d.onboarding.complete(bad))).toBeInstanceOf(ValidationError);
    expectEmpty(env);
  });

  it('un fallo al marcar onboardingCompletedAt revierte todo lo anterior', () => {
    const env = setup();
    failOn(env, 'UPDATE', 'users', 'WHEN NEW.onboarding_completed_at IS NOT NULL');
    expect(() => env.d.onboarding.complete(draft())).toThrow(/boom/);
    expectEmpty(env);
  });

  it('exito: cuentas con OPENING (sin ingreso), recurrentes sin fecha o normalizados, flags elegidos y completedAt', () => {
    const env = setup();
    const { d } = env;
    const { result, effects } = d.onboarding.complete(draft());
    expect(result.accountIds).toHaveLength(2);
    expect(result.recurringIds).toHaveLength(3);
    expect(count(env, 'balance_adjustments', "reason = 'OPENING'")).toBe(2);
    expect(count(env, 'transactions')).toBe(0);
    expect(d.reports.monthStatementOf().ingresoTotal).toBe(0);
    expect(d.accounts.summary().totalMinor).toBe(950_000);
    const rec = d.recurring.list();
    expect(rec.find((r) => r.name === 'Sueldo')).toMatchObject({ anchorDate: '2026-03-15', nextDueDate: '2026-03-15' });
    expect(rec.find((r) => r.name === 'Internet')).toMatchObject({ anchorDate: null, nextDueDate: null });
    // La eleccion explicita del usuario (cashflow = apagado) no la pisa el ingreso pasivo del paso 2.
    expect(d.settings.get()).toMatchObject({ widgetCashflow: 0, widgetDebts: 1, widgetGoals: 0, onboardingCompletedAt: localMs(2026, 3, 10) });
    expect(effects.refresh).toEqual(expect.arrayContaining(['accounts', 'settings', 'recurring']));
    expectIntegrity(d);
  });

  it('A9: con los tres widgets omitidos (null) los flags quedan en NULL, no en 0', () => {
    const env = setup();
    const { d } = env;
    const bare: OnboardingDraft = { accounts: [], recurring: [], widgets: { cashflow: null, debts: null, goals: null } };
    d.onboarding.complete(bare);
    expect(d.settings.get()).toMatchObject({ widgetCashflow: null, widgetDebts: null, widgetGoals: null });
    expect(d.settings.get().onboardingCompletedAt).not.toBeNull();
  });

  it('A9: widgets ausentes equivalen a omitidos (NULL)', () => {
    const env = setup();
    env.d.onboarding.complete({ accounts: [], recurring: [], widgets: {} });
    expect(env.d.settings.get()).toMatchObject({ widgetCashflow: null, widgetDebts: null, widgetGoals: null });
  });

  it('A9: con uno activado deja 1 y los otros NULL', () => {
    const env = setup();
    env.d.onboarding.complete({ accounts: [], recurring: [], widgets: { cashflow: null, debts: true, goals: null } });
    expect(env.d.settings.get()).toMatchObject({ widgetCashflow: null, widgetDebts: 1, widgetGoals: null });
  });

  it('A9: tras el onboarding con flags NULL, la primera deuda/meta/ingreso pasivo los activa', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'E', 100_000);
    d.onboarding.complete({ accounts: [], recurring: [], widgets: { cashflow: null, debts: null, goals: null } });
    d.debts.create({ name: 'D', balanceMinor: 10, rate: { known: 0 } });
    d.goals.create({ name: 'G', targetMinor: 10 });
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 10, isPassive: true });
    expect(d.settings.get()).toMatchObject({ widgetCashflow: 1, widgetDebts: 1, widgetGoals: 1 });
  });

  it('A9: un ingreso pasivo recurrente del paso 2 activa por nudge un widget omitido (NULL), pero no pisa un 0 explicito', () => {
    const passive = { type: 'INCOME' as const, name: 'Arriendo', amountMinor: 700_000, isPassive: true, frequency: 'MONTHLY' as const };
    const a = setup();
    a.d.onboarding.complete({ accounts: [], recurring: [passive], widgets: { cashflow: null, debts: null, goals: null } });
    expect(a.d.settings.get()).toMatchObject({ widgetCashflow: 1, widgetDebts: null, widgetGoals: null });
    const b = setup();
    b.d.onboarding.complete({ accounts: [], recurring: [passive], widgets: { cashflow: false, debts: null, goals: null } });
    expect(b.d.settings.get()).toMatchObject({ widgetCashflow: 0, widgetDebts: null, widgetGoals: null });
  });

  it('no se puede completar dos veces (no duplica nada)', () => {
    const env = setup();
    env.d.onboarding.complete(draft());
    expect(thrown(() => env.d.onboarding.complete(draft()))).toBeInstanceOf(OnboardingAlreadyCompletedError);
    expect(count(env, 'accounts')).toBe(2);
  });
});
