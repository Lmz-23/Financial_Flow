import { DEFAULT_USER_ID } from '../database/seed';
import type { AppDatabase } from '../database/types';
import { createAccountService } from './services/AccountService';
import { createDebtService } from './services/DebtService';
import { createGoalService } from './services/GoalService';
import { createIntegrityService } from './services/IntegrityService';
import { createOnboardingService } from './services/OnboardingService';
import { createRecurringService } from './services/RecurringService';
import { createReportService } from './services/ReportService';
import { createSettingsService } from './services/SettingsService';
import { createTransactionService } from './services/TransactionService';
import type { DomainContext } from './services/shared';

export interface CreateDomainOptions {
  /** Usuario de la sesion (por defecto 'default-user'; no hay autenticacion en el MVP). */
  userId?: string;
  /** Reloj: epoch ms. Inyectable para tests deterministas. */
  now?: () => number;
}

/**
 * Fabrica del dominio: inyecta la BD (cliente expo-sqlite en la app, better-sqlite3 en tests) y
 * devuelve todos los servicios. Este modulo no importa `src/database/client` ni `expo-*`.
 */
export function createDomain(db: AppDatabase, options: CreateDomainOptions = {}) {
  const ctx: DomainContext = {
    db,
    userId: options.userId ?? DEFAULT_USER_ID,
    // Unico reloj por defecto del dominio; los servicios solo llaman a ctx.now().
    now: options.now ?? (() => Date.now()),
  };
  return {
    accounts: createAccountService(ctx),
    transactions: createTransactionService(ctx),
    debts: createDebtService(ctx),
    goals: createGoalService(ctx),
    recurring: createRecurringService(ctx),
    settings: createSettingsService(ctx),
    onboarding: createOnboardingService(ctx),
    reports: createReportService(ctx),
    integrity: createIntegrityService(ctx),
  };
}

export type Domain = ReturnType<typeof createDomain>;
