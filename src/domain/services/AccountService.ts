import { accountRepository, type AccountRow, type AccountType } from '../../database/repositories/accountRepository';
import { adjustmentRepository } from '../../database/repositories/adjustmentRepository';
import { recurringRepository } from '../../database/repositories/recurringRepository';
import type { DbOrTx } from '../../database/types';
import { NotFoundError, ValidationError } from './errors';
import {
  assertInteger,
  cleanName,
  requireActiveAccount,
  runOperation,
  type DomainContext,
  type EffectsCollector,
  type OperationResult,
} from './shared';

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  /** Saldo inicial (puede ser negativo; 0 no crea ajuste). */
  openingMinor: number;
}

export interface UpdateAccountInput {
  name?: string;
  /** Nuevo disponible: genera un ajuste MANUAL con anterior, nuevo y diferencia. */
  balanceMinor?: number;
}

export interface AccountView extends AccountRow {
  /** Disponible derivado (§3.1). */
  availableMinor: number;
}

export interface AccountsSummary {
  accounts: AccountView[];
  /** Σ disponible de las cuentas no archivadas ("Resumen de cuentas"). */
  totalMinor: number;
}

export type RemoveAccountOutcome = 'DELETED' | 'ARCHIVED';

/** Compartido con OnboardingService (misma transaccion). */
export function createAccountIn(tx: DbOrTx, ctx: DomainContext, input: CreateAccountInput): string {
  const name = cleanName(input.name, 'El nombre de la cuenta');
  assertInteger(input.openingMinor, 'El saldo inicial');
  const now = ctx.now();
  const id = accountRepository.insert(tx, {
    userId: ctx.userId,
    name,
    type: input.type,
    order: accountRepository.maxOrder(tx, ctx.userId) + 1,
    now,
  });
  if (input.openingMinor !== 0) {
    adjustmentRepository.insert(tx, {
      userId: ctx.userId,
      target: { type: 'ACCOUNT', id },
      previousMinor: 0,
      newMinor: input.openingMinor,
      reason: 'OPENING',
      now,
    });
  }
  return id;
}

export function createAccountService(ctx: DomainContext) {
  return {
    /** Inserta la cuenta y, si el saldo inicial no es 0, un ajuste OPENING (anterior 0). */
    create(input: CreateAccountInput): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx: EffectsCollector) => {
        const id = createAccountIn(tx, ctx, input);
        fx.refresh('accounts');
        return { id };
      });
    },

    /** Renombrar toca solo `accounts.name`; cambiar el saldo crea un ajuste MANUAL. */
    update(id: string, input: UpdateAccountInput): OperationResult<{ adjusted: boolean }> {
      return runOperation(ctx, (tx, fx) => {
        const account = requireActiveAccount(tx, ctx.userId, id);
        const now = ctx.now();
        let adjusted = false;
        if (input.name !== undefined) {
          const name = cleanName(input.name, 'El nombre de la cuenta');
          if (name !== account.name) {
            accountRepository.rename(tx, ctx.userId, id, name, now);
            fx.refresh('accounts', 'transactions');
          }
        }
        if (input.balanceMinor !== undefined) {
          assertInteger(input.balanceMinor, 'El saldo');
          const current = accountRepository.availableOf(tx, ctx.userId, id);
          if (input.balanceMinor !== current) {
            adjustmentRepository.insert(tx, {
              userId: ctx.userId,
              target: { type: 'ACCOUNT', id },
              previousMinor: current,
              newMinor: input.balanceMinor,
              reason: 'MANUAL',
              now,
            });
            adjusted = true;
            fx.refresh('accounts');
          }
        }
        return { adjusted };
      });
    },

    /**
     * Sin movimientos: borrado real (con sus ajustes). Con movimientos: se ARCHIVA, con un ajuste
     * ARCHIVE_CLOSE que deja el disponible en 0 (D2).
     */
    remove(id: string): OperationResult<{ outcome: RemoveAccountOutcome }> {
      return runOperation(ctx, (tx, fx) => {
        const account = accountRepository.getById(tx, ctx.userId, id);
        if (!account) throw new NotFoundError('Cuenta', id);
        if (account.archivedAt !== null) throw new ValidationError('La cuenta ya esta archivada');
        const now = ctx.now();
        recurringRepository.clearDefaultAccount(tx, ctx.userId, id, now);
        fx.refresh('accounts', 'recurring');
        if (!accountRepository.hasMovements(tx, ctx.userId, id)) {
          adjustmentRepository.deleteFor(tx, ctx.userId, { type: 'ACCOUNT', id });
          accountRepository.delete(tx, ctx.userId, id);
          return { outcome: 'DELETED' as const };
        }
        const available = accountRepository.availableOf(tx, ctx.userId, id);
        if (available !== 0) {
          adjustmentRepository.insert(tx, {
            userId: ctx.userId,
            target: { type: 'ACCOUNT', id },
            previousMinor: available,
            newMinor: 0,
            reason: 'ARCHIVE_CLOSE',
            now,
          });
        }
        accountRepository.archive(tx, ctx.userId, id, now);
        return { outcome: 'ARCHIVED' as const };
      });
    },

    /**
     * Quita `archivedAt` de una cuenta archivada: vuelve a las listas, a los selectores y al total, y
     * puede recibir movimientos. NO crea ajustes: el ARCHIVE_CLOSE que la dejo en 0 queda como historial
     * (su disponible sigue en 0). Errores: `NotFoundError` si no existe o es de otro usuario;
     * `ValidationError` si la cuenta NO esta archivada (SUPUESTO: no hay error especifico).
     * Efectos: `accounts` y `goals` (los aportes/reembolsos de metas exponen `accountArchived`);
     * no `statement` (el estado financiero no depende de si la cuenta esta archivada).
     */
    unarchive(id: string): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        const account = accountRepository.getById(tx, ctx.userId, id);
        if (!account) throw new NotFoundError('Cuenta', id);
        if (account.archivedAt === null) throw new ValidationError('La cuenta no esta archivada');
        accountRepository.unarchive(tx, ctx.userId, id, ctx.now());
        fx.refresh('accounts', 'goals');
        return { id };
      });
    },

    // --- Consultas (solo lectura) -------------------------------------------

    /** Cuentas no archivadas con su disponible derivado y el total. */
    summary(): AccountsSummary {
      const available = accountRepository.availableByAccount(ctx.db, ctx.userId);
      const accounts = accountRepository
        .listActive(ctx.db, ctx.userId)
        .map((a) => ({ ...a, availableMinor: available.get(a.id) ?? 0 }));
      return { accounts, totalMinor: accounts.reduce((sum, a) => sum + a.availableMinor, 0) };
    },

    get(id: string): AccountView | undefined {
      const account = accountRepository.getById(ctx.db, ctx.userId, id);
      return account ? { ...account, availableMinor: accountRepository.availableOf(ctx.db, ctx.userId, id) } : undefined;
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
