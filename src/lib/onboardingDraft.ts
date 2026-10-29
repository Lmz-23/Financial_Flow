// Logica PURA del borrador del onboarding (decisiones 46 A3-A12 y 48). Sin React ni zustand: la
// usa el store `useOnboardingDraft` y se prueba en vitest. Los montos son UNIDADES MENORES.
import type { CreateAccountInput } from '../domain/services/AccountService';
import type { OnboardingDraft } from '../domain/services/OnboardingService';
import type { CreateRecurringInput } from '../domain/services/RecurringService';

export type AccountType = CreateAccountInput['type'];
export type RecurringFrequency = CreateRecurringInput['frequency'];
export type WidgetKey = keyof OnboardingDraft['widgets'];

// ---------------------------------------------------------------------------------------------
// Textos aprobados (decisiones 48 y 49). Literales: no editar sin una decision nueva.
// ---------------------------------------------------------------------------------------------
export const MSG_ACCOUNT_NAME_EMPTY = 'Escribe un nombre para la cuenta.';
export const MSG_ACCOUNT_NAME_DUPLICATE = 'Ya tienes una cuenta con ese nombre.';
export const MSG_NO_ACCOUNTS = 'Agrega al menos una cuenta para continuar.';
export const MSG_RECURRING_AMOUNT_REQUIRED = 'Escribe un monto mayor que cero.';
export const MSG_RECURRING_NAME_REQUIRED = 'Escribe un nombre para continuar.';
export const MSG_COMPLETE_VALIDATION = 'Revisa los datos marcados e inténtalo de nuevo.';
export const MSG_COMPLETE_GENERIC = 'No pudimos guardar tu información. Inténtalo de nuevo.';
export const MSG_DONE_PHRASE =
  'Puedes activar Deudas, Metas o el Índice de Flujo cuando los necesites — nunca pierdes lo que ya armaste aquí.';

// ---------------------------------------------------------------------------------------------
// Tipos del borrador
// ---------------------------------------------------------------------------------------------
export interface DraftAccount {
  /** Identificador local (solo para la lista y la edicion; no llega al dominio). */
  key: string;
  name: string;
  type: AccountType;
  /** Saldo inicial en unidades menores, >= 0 (A5). */
  openingMinor: number;
}

/** Datos de una cuenta tal como los escribe el usuario (el saldo vacio es null). */
export interface AccountFormValues {
  name: string;
  type: AccountType;
  openingMinor: number | null;
}

export type AccountError = 'EMPTY_NAME' | 'DUPLICATE_NAME';

export interface DraftRecurring {
  name: string;
  /** null = campo vacio. */
  amountMinor: number | null;
  frequency: RecurringFrequency;
}

export type RecurringKind = 'income' | 'expense';

export type DraftWidgets = Record<WidgetKey, boolean>;

export interface DraftState {
  accounts: DraftAccount[];
  income: DraftRecurring;
  expense: DraftRecurring;
  widgets: DraftWidgets;
}

/** Tipos de cuenta con su rotulo del diseño (Dashboard.dc.html: accTypesList). */
export const ACCOUNT_TYPE_OPTIONS: readonly { value: AccountType; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'SAVINGS', label: 'Cuenta de ahorros' },
  { value: 'CHECKING', label: 'Cuenta corriente' },
  { value: 'DIGITAL_WALLET', label: 'Billetera digital' },
];

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export const FREQUENCY_OPTIONS: readonly { value: RecurringFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
];

export const DEFAULT_FREQUENCY: RecurringFrequency = 'MONTHLY';

export const CASH_ACCOUNT_NAME = 'Efectivo';
export const CASH_ACCOUNT_KEY = 'cash';

export function emptyRecurring(): DraftRecurring {
  return { name: '', amountMinor: null, frequency: DEFAULT_FREQUENCY };
}

/** Estado inicial: «Efectivo» es una cuenta real del borrador con saldo 0 (A3). */
export function initialDraft(): DraftState {
  return {
    accounts: [{ key: CASH_ACCOUNT_KEY, name: CASH_ACCOUNT_NAME, type: 'CASH', openingMinor: 0 }],
    income: emptyRecurring(),
    expense: emptyRecurring(),
    widgets: { cashflow: false, debts: false, goals: false },
  };
}

// ---------------------------------------------------------------------------------------------
// Cuentas (paso 1; A3-A5, A7)
// ---------------------------------------------------------------------------------------------
/** Recorta espacios al inicio y al final (A7). */
export function cleanText(text: string): string {
  return text.trim();
}

/** Clave de comparacion de nombres: recortada y sin distinguir mayusculas (A7). */
export function nameKey(name: string): string {
  return cleanText(name).toLocaleLowerCase('es');
}

export function validateAccountName(
  accounts: readonly DraftAccount[],
  name: string,
  excludeKey?: string,
): AccountError | null {
  const key = nameKey(name);
  if (key === '') return 'EMPTY_NAME';
  if (accounts.some((a) => a.key !== excludeKey && nameKey(a.name) === key)) return 'DUPLICATE_NAME';
  return null;
}

export function accountErrorMessage(error: AccountError): string {
  return error === 'EMPTY_NAME' ? MSG_ACCOUNT_NAME_EMPTY : MSG_ACCOUNT_NAME_DUPLICATE;
}

/** Saldo inicial: vacio = 0; nunca negativo (A5). */
export function normalizeOpening(openingMinor: number | null): number {
  return openingMinor === null || !Number.isFinite(openingMinor) || openingMinor < 0 ? 0 : openingMinor;
}

export type AccountsResult = { ok: true; accounts: DraftAccount[] } | { ok: false; error: AccountError };

/** Agrega una cuenta (sin limite de cuentas). `key` lo genera quien llama. */
export function addAccount(accounts: readonly DraftAccount[], values: AccountFormValues, key: string): AccountsResult {
  const error = validateAccountName(accounts, values.name);
  if (error) return { ok: false, error };
  const account: DraftAccount = {
    key,
    name: cleanText(values.name),
    type: values.type,
    openingMinor: normalizeOpening(values.openingMinor),
  };
  return { ok: true, accounts: [...accounts, account] };
}

/** Edita una cuenta existente (el duplicado excluye a la propia cuenta). */
export function updateAccount(
  accounts: readonly DraftAccount[],
  key: string,
  values: AccountFormValues,
): AccountsResult {
  const error = validateAccountName(accounts, values.name, key);
  if (error) return { ok: false, error };
  return {
    ok: true,
    accounts: accounts.map((a) =>
      a.key === key
        ? { key, name: cleanText(values.name), type: values.type, openingMinor: normalizeOpening(values.openingMinor) }
        : a,
    ),
  };
}

export function removeAccount(accounts: readonly DraftAccount[], key: string): DraftAccount[] {
  return accounts.filter((a) => a.key !== key);
}

/** Paso 1 al pulsar «Continuar»: al menos una cuenta (A3). */
export function validateAccountsStep(accounts: readonly DraftAccount[]): 'NO_ACCOUNTS' | null {
  return accounts.length === 0 ? 'NO_ACCOUNTS' : null;
}

// ---------------------------------------------------------------------------------------------
// Recurrentes (paso 2; A11, A12)
// ---------------------------------------------------------------------------------------------
export interface RecurringErrors {
  /** Mensaje junto al campo del nombre. */
  name: string | null;
  /** Mensaje junto al campo del monto. */
  amount: string | null;
}

/** Una fila esta en uso cuando tiene nombre (recortado) o un monto mayor que cero. */
export function recurringIsBlank(entry: DraftRecurring): boolean {
  return cleanText(entry.name) === '' && (entry.amountMinor === null || entry.amountMinor <= 0);
}

/**
 * Valida una fila del paso 2. Opcional: fila vacia = sin errores y se omite. Nombre sin monto
 * (o monto 0) bloquea junto al monto; monto sin nombre bloquea junto al nombre.
 */
export function validateRecurring(entry: DraftRecurring): RecurringErrors {
  const hasName = cleanText(entry.name) !== '';
  const hasAmount = entry.amountMinor !== null && entry.amountMinor > 0;
  return {
    name: !hasName && hasAmount ? MSG_RECURRING_NAME_REQUIRED : null,
    amount: hasName && !hasAmount ? MSG_RECURRING_AMOUNT_REQUIRED : null,
  };
}

export function validateFlowStep(draft: Pick<DraftState, 'income' | 'expense'>): {
  income: RecurringErrors;
  expense: RecurringErrors;
  ok: boolean;
} {
  const income = validateRecurring(draft.income);
  const expense = validateRecurring(draft.expense);
  const ok = !income.name && !income.amount && !expense.name && !expense.amount;
  return { income, expense, ok };
}

// ---------------------------------------------------------------------------------------------
// Conversion al OnboardingDraft del dominio
// ---------------------------------------------------------------------------------------------
/**
 * Arma el borrador que consume `commands.onboarding.complete`. Widgets (A9): `true` para los
 * activados y `null` (NUNCA false) para los demas. Recurrentes: solo las filas completas, sin
 * fecha, pasivo ni cuenta predeterminada (A12). Los nombres van recortados.
 */
export function toOnboardingDraft(draft: DraftState): OnboardingDraft {
  const recurring: CreateRecurringInput[] = [];
  for (const [type, entry] of [
    ['INCOME', draft.income],
    ['EXPENSE', draft.expense],
  ] as const) {
    if (recurringIsBlank(entry)) continue;
    recurring.push({
      type,
      name: cleanText(entry.name),
      amountMinor: entry.amountMinor as number,
      frequency: entry.frequency,
    });
  }
  return {
    accounts: draft.accounts.map((a) => ({ name: cleanText(a.name), type: a.type, openingMinor: a.openingMinor })),
    recurring,
    widgets: {
      cashflow: draft.widgets.cashflow ? true : null,
      debts: draft.widgets.debts ? true : null,
      goals: draft.widgets.goals ? true : null,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Resultado de `complete` (A10)
// ---------------------------------------------------------------------------------------------
export type CompleteOutcome =
  | { kind: 'success' }
  | { kind: 'validation'; message: string }
  | { kind: 'error'; message: string };

/**
 * Clasifica el error de `complete` por su `code` (errores tipados del dominio). Nunca devuelve
 * el mensaje tecnico. ONBOARDING_ALREADY_COMPLETED cuenta como exito (la UI recarga los ajustes).
 */
export function classifyCompleteError(error: unknown): CompleteOutcome {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : undefined;
  if (code === 'ONBOARDING_ALREADY_COMPLETED') return { kind: 'success' };
  if (code === 'VALIDATION') return { kind: 'validation', message: MSG_COMPLETE_VALIDATION };
  return { kind: 'error', message: MSG_COMPLETE_GENERIC };
}

/** Texto para lectores de pantalla de la barra de progreso (A18). */
export const ONBOARDING_TOTAL_STEPS = 4;
export function stepLabel(step: number): string {
  return `Paso ${step} de ${ONBOARDING_TOTAL_STEPS}`;
}
