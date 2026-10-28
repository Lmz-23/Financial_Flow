// =============================================================================
// COMANDOS DE LA APLICACION
// =============================================================================
// Cada comando llama a una operacion de dominio (una transaccion de BD sincrona), y SOLO despues
// del COMMIT ejecuta los `effects` que devolvio (refrescar la interfaz, reconciliar
// notificaciones). Si la operacion lanza, no se ejecuta ningun efecto y el error llega a la
// pantalla tal cual (errores tipados de src/domain/services/errors.ts).
//
// Este modulo no importa `database/client` ni `expo-*`: la BD, el dominio y los efectos entran por
// inyeccion (ver index.ts), asi se prueba con better-sqlite3 en vitest.
import type { Domain } from '../domain/createDomain';
import type { CreateAccountInput, UpdateAccountInput } from '../domain/services/AccountService';
import type { CreateDebtInput, RegisterPaymentInput, UpdateDebtInput } from '../domain/services/DebtService';
import type { ContributeInput, CreateGoalInput, RemoveGoalOptions, UpdateGoalInput } from '../domain/services/GoalService';
import type { OnboardingDraft } from '../domain/services/OnboardingService';
import type {
  ConfirmOccurrenceInput,
  CreateRecurringInput,
  UpdateRecurringInput,
} from '../domain/services/RecurringService';
import type { NotificationsInput, ThemePreference } from '../domain/services/SettingsService';
import type { DomainEffects, OperationResult } from '../domain/services/shared';
import type { CreateTransactionInput } from '../domain/services/TransactionService';
import type { CreateTransferInput, UpdateTransferInput } from '../domain/services/TransferService';
import type { LocalDate } from '../domain/dates';
import type { WidgetKey } from '../database/repositories/settingsRepository';

export function createCommands(getDomain: () => Domain, applyEffects: (effects: DomainEffects) => void) {
  /** Ejecuta la operacion y, tras el COMMIT, sus efectos. Devuelve solo el resultado. */
  function run<R>(operation: (domain: Domain) => OperationResult<R>): R {
    const { result, effects } = operation(getDomain());
    applyEffects(effects);
    return result;
  }

  return {
    accounts: {
      create: (input: CreateAccountInput) => run((d) => d.accounts.create(input)),
      update: (id: string, input: UpdateAccountInput) => run((d) => d.accounts.update(id, input)),
      remove: (id: string) => run((d) => d.accounts.remove(id)),
      /** Contrato F5: la UI lo ofrece al atrapar `AccountArchivedError` (usa `error.accountId`) y reintenta. */
      unarchive: (id: string) => run((d) => d.accounts.unarchive(id)),
    },
    transactions: {
      create: (input: CreateTransactionInput) => run((d) => d.transactions.create(input)),
      remove: (id: string) => run((d) => d.transactions.remove(id)),
    },
    /** Transferencias entre cuentas: no son ingreso ni gasto. Origen sin fondos -> `InsufficientFundsError`. */
    transfers: {
      create: (input: CreateTransferInput) => run((d) => d.transfers.create(input)),
      update: (id: string, input: UpdateTransferInput) => run((d) => d.transfers.update(id, input)),
      remove: (id: string) => run((d) => d.transfers.remove(id)),
    },
    debts: {
      create: (input: CreateDebtInput) => run((d) => d.debts.create(input)),
      update: (id: string, input: UpdateDebtInput) => run((d) => d.debts.update(id, input)),
      registerPayment: (input: RegisterPaymentInput) => run((d) => d.debts.registerPayment(input)),
      remove: (id: string) => run((d) => d.debts.remove(id)),
    },
    goals: {
      create: (input: CreateGoalInput) => run((d) => d.goals.create(input)),
      contribute: (input: ContributeInput) => run((d) => d.goals.contribute(input)),
      update: (id: string, input: UpdateGoalInput) => run((d) => d.goals.update(id, input)),
      close: (id: string) => run((d) => d.goals.close(id)),
      /** Contrato F5: llamar antes a `goals.refundPreview` (consulta) y pasar `refundAccountId` si hace falta. */
      remove: (id: string, options?: RemoveGoalOptions) => run((d) => d.goals.remove(id, options)),
    },
    recurring: {
      create: (input: CreateRecurringInput) => run((d) => d.recurring.create(input)),
      update: (id: string, input: UpdateRecurringInput) => run((d) => d.recurring.update(id, input)),
      remove: (id: string) => run((d) => d.recurring.remove(id)),
      confirmOccurrence: (input: ConfirmOccurrenceInput) => run((d) => d.recurring.confirmOccurrence(input)),
      unconfirm: (recurringId: string, occurrenceDate: LocalDate) =>
        run((d) => d.recurring.unconfirm(recurringId, occurrenceDate)),
      snooze: (recurringId: string) => run((d) => d.recurring.snooze(recurringId)),
    },
    settings: {
      setTheme: (theme: ThemePreference) => run((d) => d.settings.setTheme(theme)),
      setNotifications: (input: NotificationsInput) => run((d) => d.settings.setNotifications(input)),
      setWidget: (widget: WidgetKey, on: boolean) => run((d) => d.settings.setWidget(widget, on)),
      autoActivate: (widget: WidgetKey) => run((d) => d.settings.autoActivate(widget)),
    },
    onboarding: {
      complete: (draft: OnboardingDraft) => run((d) => d.onboarding.complete(draft)),
    },
  };
}

export type Commands = ReturnType<typeof createCommands>;
