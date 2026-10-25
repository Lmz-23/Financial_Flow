// =============================================================================
// BORRADOR DEL ONBOARDING (arquitectura 4.3; decision 46)
// =============================================================================
// Store zustand NO persistido: vive en memoria mientras dura el onboarding (A6: cerrar la app
// reinicia desde el paso 1). Nada se escribe en SQLite hasta `commands.onboarding.complete`. Las
// reglas estan en src/lib/onboardingDraft.ts (puras, con tests).
import { create } from 'zustand';

import {
  addAccount,
  initialDraft,
  removeAccount,
  updateAccount,
  type AccountError,
  type AccountFormValues,
  type DraftRecurring,
  type DraftState,
  type RecurringKind,
  type WidgetKey,
} from '../lib/onboardingDraft';

type AccountOutcome = { ok: true } | { ok: false; error: AccountError };

interface OnboardingDraftState extends DraftState {
  addAccount: (values: AccountFormValues) => AccountOutcome;
  updateAccount: (key: string, values: AccountFormValues) => AccountOutcome;
  removeAccount: (key: string) => void;
  setRecurring: (kind: RecurringKind, patch: Partial<DraftRecurring>) => void;
  setWidget: (widget: WidgetKey, on: boolean) => void;
  /** «Prefiero explorarlo yo mismo» (A9): apaga los tres widgets, que viajan como NULL. */
  clearWidgets: () => void;
  /** Vuelve al estado inicial (se llama tras un `complete` exitoso). */
  reset: () => void;
}

let accountCounter = 0;
function nextAccountKey(): string {
  accountCounter += 1;
  return `acc-${accountCounter}`;
}

export const useOnboardingDraft = create<OnboardingDraftState>((set, get) => ({
  ...initialDraft(),
  addAccount: (values) => {
    const result = addAccount(get().accounts, values, nextAccountKey());
    if (!result.ok) return result;
    set({ accounts: result.accounts });
    return { ok: true };
  },
  updateAccount: (key, values) => {
    const result = updateAccount(get().accounts, key, values);
    if (!result.ok) return result;
    set({ accounts: result.accounts });
    return { ok: true };
  },
  removeAccount: (key) => set({ accounts: removeAccount(get().accounts, key) }),
  setRecurring: (kind, patch) => set({ [kind]: { ...get()[kind], ...patch } } as Pick<DraftState, RecurringKind>),
  setWidget: (widget, on) => set({ widgets: { ...get().widgets, [widget]: on } }),
  clearWidgets: () => set({ widgets: initialDraft().widgets }),
  reset: () => set(initialDraft()),
}));

/** Solo los datos del borrador (sin acciones), para convertirlo con `toOnboardingDraft`. */
export function selectDraft(state: OnboardingDraftState): DraftState {
  return { accounts: state.accounts, income: state.income, expense: state.expense, widgets: state.widgets };
}
