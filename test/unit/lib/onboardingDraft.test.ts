import { beforeEach, describe, expect, it } from 'vitest';

import {
  addAccount,
  classifyCompleteError,
  initialDraft,
  MSG_ACCOUNT_NAME_DUPLICATE,
  MSG_ACCOUNT_NAME_EMPTY,
  MSG_COMPLETE_GENERIC,
  MSG_COMPLETE_VALIDATION,
  MSG_NO_ACCOUNTS,
  MSG_RECURRING_AMOUNT_REQUIRED,
  MSG_RECURRING_NAME_REQUIRED,
  accountErrorMessage,
  removeAccount,
  stepLabel,
  toOnboardingDraft,
  updateAccount,
  validateAccountsStep,
  validateFlowStep,
  validateRecurring,
  type AccountFormValues,
  type DraftState,
} from '../../../src/lib/onboardingDraft';
import { selectDraft, useOnboardingDraft } from '../../../src/store/useOnboardingDraft';

const form = (name: string, openingMinor: number | null = null, type: AccountFormValues['type'] = 'SAVINGS'): AccountFormValues => ({
  name,
  type,
  openingMinor,
});

describe('estado inicial', () => {
  it('«Efectivo» es una cuenta real del borrador con saldo 0 y todo lo demás vacío/apagado', () => {
    const d = initialDraft();
    expect(d.accounts).toEqual([{ key: 'cash', name: 'Efectivo', type: 'CASH', openingMinor: 0 }]);
    expect(d.income).toEqual({ name: '', amountMinor: null, frequency: 'MONTHLY' });
    expect(d.expense).toEqual({ name: '', amountMinor: null, frequency: 'MONTHLY' });
    expect(d.widgets).toEqual({ cashflow: false, debts: false, goals: false });
  });
});

describe('cuentas (A3-A7)', () => {
  it('recorta espacios y guarda el saldo', () => {
    const r = addAccount(initialDraft().accounts, form('  Bancolombia  ', 250000), 'k1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.accounts[1]).toEqual({ key: 'k1', name: 'Bancolombia', type: 'SAVINGS', openingMinor: 250000 });
  });

  it('nombre vacío o solo espacios -> EMPTY_NAME con el texto aprobado', () => {
    for (const name of ['', '   ']) {
      const r = addAccount(initialDraft().accounts, form(name), 'k');
      expect(r).toEqual({ ok: false, error: 'EMPTY_NAME' });
    }
    expect(accountErrorMessage('EMPTY_NAME')).toBe(MSG_ACCOUNT_NAME_EMPTY);
    expect(MSG_ACCOUNT_NAME_EMPTY).toBe('Escribe un nombre para la cuenta.');
  });

  it('bloquea duplicados sin distinguir mayúsculas ni espacios, también contra «Efectivo»', () => {
    const base = initialDraft().accounts;
    expect(addAccount(base, form(' efectivo '), 'k')).toEqual({ ok: false, error: 'DUPLICATE_NAME' });
    expect(addAccount(base, form('EFECTIVO'), 'k')).toEqual({ ok: false, error: 'DUPLICATE_NAME' });
    expect(accountErrorMessage('DUPLICATE_NAME')).toBe(MSG_ACCOUNT_NAME_DUPLICATE);
    expect(MSG_ACCOUNT_NAME_DUPLICATE).toBe('Ya tienes una cuenta con ese nombre.');
  });

  it('saldo vacío = 0 y un saldo negativo se normaliza a 0 (A5)', () => {
    const r1 = addAccount([], form('A', null), 'a');
    const r2 = addAccount([], form('B', -5), 'b');
    expect(r1.ok && r1.accounts[0]!.openingMinor).toBe(0);
    expect(r2.ok && r2.accounts[0]!.openingMinor).toBe(0);
  });

  it('sin límite de cuentas', () => {
    let accounts = initialDraft().accounts;
    for (let i = 0; i < 50; i++) {
      const r = addAccount(accounts, form(`Cuenta ${i}`), `k${i}`);
      expect(r.ok).toBe(true);
      if (r.ok) accounts = r.accounts;
    }
    expect(accounts).toHaveLength(51);
  });

  it('editar: conservar el propio nombre (aunque cambie la capitalización) no es duplicado; chocar con otra sí', () => {
    const base = initialDraft().accounts;
    const withB = addAccount(base, form('Ahorros'), 'b');
    if (!withB.ok) throw new Error('setup');
    const ok = updateAccount(withB.accounts, 'cash', form('EFECTIVO', 5000, 'CASH'));
    expect(ok.ok && ok.accounts[0]).toEqual({ key: 'cash', name: 'EFECTIVO', type: 'CASH', openingMinor: 5000 });
    expect(updateAccount(withB.accounts, 'cash', form('ahorros', 0, 'CASH'))).toEqual({ ok: false, error: 'DUPLICATE_NAME' });
  });

  it('quitar cuenta y la regla de al menos una (A3)', () => {
    const accounts = initialDraft().accounts;
    expect(validateAccountsStep(accounts)).toBeNull();
    expect(validateAccountsStep(removeAccount(accounts, 'cash'))).toBe('NO_ACCOUNTS');
    expect(MSG_NO_ACCOUNTS).toBe('Agrega al menos una cuenta para continuar.');
  });
});

describe('paso 2 (A11/A12)', () => {
  const entry = (name: string, amountMinor: number | null) => ({ name, amountMinor, frequency: 'MONTHLY' as const });

  it('vacío es válido (opcional)', () => {
    expect(validateRecurring(entry('', null))).toEqual({ name: null, amount: null });
    expect(validateRecurring(entry('  ', 0))).toEqual({ name: null, amount: null });
  });

  it('nombre sin monto (o monto 0) bloquea junto al monto', () => {
    expect(validateRecurring(entry('Sueldo', null)).amount).toBe(MSG_RECURRING_AMOUNT_REQUIRED);
    expect(validateRecurring(entry('Sueldo', 0)).amount).toBe('Escribe un monto mayor que cero.');
  });

  it('monto con nombre vacío bloquea junto al nombre', () => {
    expect(validateRecurring(entry('   ', 5000)).name).toBe(MSG_RECURRING_NAME_REQUIRED);
    expect(MSG_RECURRING_NAME_REQUIRED).toBe('Escribe un nombre para continuar.');
  });

  it('validateFlowStep agrega ambas filas', () => {
    const d = initialDraft();
    expect(validateFlowStep(d).ok).toBe(true);
    const bad = validateFlowStep({ income: entry('Sueldo', null), expense: entry('', 100) });
    expect(bad.ok).toBe(false);
    expect(bad.income.amount).toBe(MSG_RECURRING_AMOUNT_REQUIRED);
    expect(bad.expense.name).toBe(MSG_RECURRING_NAME_REQUIRED);
  });
});

describe('toOnboardingDraft (A9, A12)', () => {
  it('widgets: true para los activados y null (NUNCA false) para los demás', () => {
    const d: DraftState = { ...initialDraft(), widgets: { cashflow: true, debts: false, goals: false } };
    expect(toOnboardingDraft(d).widgets).toEqual({ cashflow: true, debts: null, goals: null });
    const none = toOnboardingDraft(initialDraft()).widgets;
    expect(Object.values(none)).toEqual([null, null, null]);
    expect(Object.values(none)).not.toContain(false);
  });

  it('recurrentes: solo las filas completas, recortadas, sin fecha/pasivo/cuenta', () => {
    const d: DraftState = {
      ...initialDraft(),
      income: { name: ' Sueldo ', amountMinor: 300000000, frequency: 'BIWEEKLY' },
      expense: { name: '', amountMinor: null, frequency: 'MONTHLY' },
    };
    const out = toOnboardingDraft(d);
    expect(out.recurring).toEqual([{ type: 'INCOME', name: 'Sueldo', amountMinor: 300000000, frequency: 'BIWEEKLY' }]);
    expect(out.recurring[0]).not.toHaveProperty('anchorDate');
    expect(out.recurring[0]).not.toHaveProperty('isPassive');
    expect(out.recurring[0]).not.toHaveProperty('defaultAccountId');
  });

  it('gasto y ingreso por separado y cuentas sin la clave local', () => {
    const accounts = addAccount(initialDraft().accounts, form(' Nu ', 10000, 'DIGITAL_WALLET'), 'k');
    if (!accounts.ok) throw new Error('setup');
    const d: DraftState = {
      ...initialDraft(),
      accounts: accounts.accounts,
      expense: { name: 'Arriendo', amountMinor: 90000000, frequency: 'MONTHLY' },
    };
    const out = toOnboardingDraft(d);
    expect(out.accounts).toEqual([
      { name: 'Efectivo', type: 'CASH', openingMinor: 0 },
      { name: 'Nu', type: 'DIGITAL_WALLET', openingMinor: 10000 },
    ]);
    expect(out.recurring.map((r) => r.type)).toEqual(['EXPENSE']);
  });
});

describe('errores de complete (A10)', () => {
  it('ONBOARDING_ALREADY_COMPLETED se trata como éxito', () => {
    expect(classifyCompleteError({ code: 'ONBOARDING_ALREADY_COMPLETED' })).toEqual({ kind: 'success' });
  });
  it('VALIDATION y desconocido usan los textos aprobados y nunca el mensaje técnico', () => {
    expect(classifyCompleteError({ code: 'VALIDATION', message: 'SQL secreto' })).toEqual({
      kind: 'validation',
      message: MSG_COMPLETE_VALIDATION,
    });
    expect(classifyCompleteError(new Error('SQLITE_CONSTRAINT: INSERT ...'))).toEqual({ kind: 'error', message: MSG_COMPLETE_GENERIC });
    expect(classifyCompleteError('boom')).toEqual({ kind: 'error', message: MSG_COMPLETE_GENERIC });
    expect(MSG_COMPLETE_VALIDATION).toBe('Revisa los datos marcados e inténtalo de nuevo.');
    expect(MSG_COMPLETE_GENERIC).toBe('No pudimos guardar tu información. Inténtalo de nuevo.');
  });
});

describe('progreso', () => {
  it('texto para lectores de pantalla', () => {
    expect(stepLabel(2)).toBe('Paso 2 de 4');
  });
});

describe('store useOnboardingDraft', () => {
  beforeEach(() => useOnboardingDraft.getState().reset());

  it('agrega, edita y rechaza duplicados; volver atrás no duplica', () => {
    const s = useOnboardingDraft.getState();
    expect(s.addAccount(form('Nu', 100, 'DIGITAL_WALLET'))).toEqual({ ok: true });
    expect(useOnboardingDraft.getState().addAccount(form('nu'))).toEqual({ ok: false, error: 'DUPLICATE_NAME' });
    expect(useOnboardingDraft.getState().accounts).toHaveLength(2);
  });

  it('setRecurring y setWidget conservan lo ya escrito; reset vuelve al estado inicial', () => {
    const s = useOnboardingDraft.getState();
    s.setRecurring('income', { name: 'Sueldo' });
    useOnboardingDraft.getState().setRecurring('income', { amountMinor: 5 });
    useOnboardingDraft.getState().setWidget('goals', true);
    const cur = useOnboardingDraft.getState();
    expect(cur.income).toEqual({ name: 'Sueldo', amountMinor: 5, frequency: 'MONTHLY' });
    expect(cur.widgets.goals).toBe(true);
    cur.reset();
    const after = useOnboardingDraft.getState();
    expect(after.income).toEqual(initialDraft().income);
    expect(after.widgets).toEqual(initialDraft().widgets);
    expect(after.accounts).toEqual(initialDraft().accounts);
  });

  it('«Prefiero explorarlo yo mismo» descarta lo marcado: los tres widgets viajan como NULL y el resto se conserva (A9)', () => {
    useOnboardingDraft.getState().addAccount(form('Nu', 100, 'DIGITAL_WALLET'));
    useOnboardingDraft.getState().setRecurring('income', { name: 'Sueldo', amountMinor: 5 });
    useOnboardingDraft.getState().setWidget('cashflow', true);
    useOnboardingDraft.getState().setWidget('debts', true);
    expect(toOnboardingDraft(selectDraft(useOnboardingDraft.getState())).widgets).toEqual({
      cashflow: true,
      debts: true,
      goals: null,
    });

    useOnboardingDraft.getState().clearWidgets();

    const after = useOnboardingDraft.getState();
    expect(after.widgets).toEqual({ cashflow: false, debts: false, goals: false });
    const sent = toOnboardingDraft(selectDraft(after));
    expect(sent.widgets).toEqual({ cashflow: null, debts: null, goals: null });
    expect(sent.accounts.map((a) => a.name)).toEqual(['Efectivo', 'Nu']);
    expect(sent.recurring).toEqual([{ type: 'INCOME', name: 'Sueldo', amountMinor: 5, frequency: 'MONTHLY' }]);
  });
});
