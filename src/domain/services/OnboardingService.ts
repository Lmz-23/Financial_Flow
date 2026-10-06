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
  /** Paso 3: eleccion explicita de widgets (1 activo / 0 apagado). */
  widgets: Record<WidgetKey, boolean>;
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
        // Eleccion explicita: se aplica DESPUES de los recurrentes para que un ingreso pasivo
        // (autoActivate) no pise un 0 elegido por el usuario.
        for (const widget of ['cashflow', 'debts', 'goals'] as const) {
          settingsRepository.setWidget(tx, ctx.userId, widget, draft.widgets[widget], ctx.now());
        }
        settingsRepository.markOnboardingCompleted(tx, ctx.userId, ctx.now());
        fx.refresh('accounts', 'settings');
        return { accountIds, recurringIds };
      });
    },
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
