import { settingsRepository, type WidgetKey } from '../../database/repositories/settingsRepository';
import { createAccountIn, type CreateAccountInput } from './AccountService';
import { NotFoundError, OnboardingAlreadyCompletedError } from './errors';
import { createStandardRecurringIn, type CreateRecurringInput } from './RecurringService';
import { runOperation, type DomainContext, type OperationResult } from './shared';

export interface OnboardingDraft {
  /** Paso 1: cuentas con saldo inicial (cada una con OPENING si el saldo no es 0). */
  accounts: CreateAccountInput[];
  /** Paso 2: ingresos y gastos recurrentes (sin fecha salvo que el usuario la indique; D7). */
  recurring: CreateRecurringInput[];
  /**
   * Paso 3: eleccion de widgets, tres estados por clave (A9):
   * `true` -> 1 (activado); `null` o ausente -> el flag NO se escribe y queda NULL (omitido: los nudges
   * de primera deuda/meta/ingreso pasivo aun pueden auto-activarlo); `false` -> 0 (apagado explicito,
   * nunca se reactiva solo). La UI del onboarding envia `true` o `null`; `false` se conserva por
   * compatibilidad con la semantica de ajustes (`SettingsService.setWidget`).
   */
  widgets: Partial<Record<WidgetKey, boolean | null>>;
}

export interface OnboardingResult {
  accountIds: string[];
  recurringIds: string[];
}

export function createOnboardingService(ctx: DomainContext) {
  return {
    /** Una sola transaccion: cuentas, recurrentes, flags de widgets y `onboardingCompletedAt`. */
    complete(draft: OnboardingDraft): OperationResult<OnboardingResult> {
      return runOperation(ctx, (tx, fx) => {
        const settings = settingsRepository.get(tx, ctx.userId);
        if (!settings) throw new NotFoundError('Usuario', ctx.userId);
        if (settings.onboardingCompletedAt !== null) throw new OnboardingAlreadyCompletedError();

        const accountIds = draft.accounts.map((a) => createAccountIn(tx, ctx, a));
        const recurringIds = draft.recurring.map((r) => createStandardRecurringIn(tx, ctx, fx, r));
        // Eleccion explicita (true/false): se aplica DESPUES de los recurrentes para que un ingreso pasivo
        // (autoActivate) no pise un 0 elegido. null/ausente: no se toca el flag (queda NULL).
        for (const widget of ['cashflow', 'debts', 'goals'] as const) {
          const choice = draft.widgets[widget];
          if (choice === null || choice === undefined) continue;
          settingsRepository.setWidget(tx, ctx.userId, widget, choice, ctx.now());
        }
        settingsRepository.markOnboardingCompleted(tx, ctx.userId, ctx.now());
        fx.refresh('accounts', 'settings');
        return { accountIds, recurringIds };
      });
    },
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
