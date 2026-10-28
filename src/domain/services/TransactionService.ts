import { accountRepository } from '../../database/repositories/accountRepository';
import { categoryRepository, type CategoryType } from '../../database/repositories/categoryRepository';
import { recurringRepository } from '../../database/repositories/recurringRepository';
import {
  transactionRepository,
  type TransactionFilters,
  type TransactionView,
} from '../../database/repositories/transactionRepository';
import type { DbOrTx } from '../../database/types';
import { isOccurrenceOfSeries } from '../rules/recurrence';
import { AccountArchivedError, NotFoundError, TransactionNotEditableError, ValidationError } from './errors';
import {
  assertEpochMs,
  assertPositiveMinor,
  autoActivateWidget,
  cleanName,
  requireActiveAccount,
  runOperation,
  type DomainContext,
  type EffectsCollector,
  type OperationResult,
} from './shared';

export interface CreateTransactionInput {
  type: 'INCOME' | 'EXPENSE';
  accountId: string;
  amountMinor: number;
  /** Categoria existente. Excluyente con `newCategoryName`. */
  categoryId?: string | null;
  /** Categoria nueva en linea: se crea (o se reutiliza si ya existe) en la misma transaccion. */
  newCategoryName?: string;
  /** Solo ingresos. */
  isPassive?: boolean;
  /** Epoch ms; por defecto el reloj del dominio. */
  date?: number;
  description?: string;
}

/** Campos editables (§2): el tipo INCOME/EXPENSE no cambia. Lo omitido se conserva. */
export interface UpdateTransactionInput {
  amountMinor?: number;
  accountId?: string;
  /** Epoch ms. Una transaccion que confirma una recurrente no cambia de fecha. */
  date?: number;
  description?: string;
  /** Categoria existente (null la quita). Excluyente con `newCategoryName`. */
  categoryId?: string | null;
  /** Categoria nueva en linea (o la existente con ese nombre). */
  newCategoryName?: string;
  /** Solo ingresos; en un gasto se fuerza false. */
  isPassive?: boolean;
}

/**
 * Borra una transaccion y reubica el recurrente ligado (`nextDueDate = min(nextDueDate, ocurrencia)`,
 * `snoozedUntil` limpio) SOLO si el recurrente tiene fecha (ancla no NULL) y la ocurrencia pertenece a
 * su serie actual; si no, `nextDueDate` no se toca. Unico camino de reversion: lo usan
 * `TransactionService.remove` y `RecurringService.unconfirm`.
 * Una cuenta archivada no vuelve a cambiar de saldo: borrar su transaccion lanza `AccountArchivedError`
 * (el usuario debe desarchivarla primero con `AccountService.unarchive`).
 */
export function removeTransactionIn(
  tx: DbOrTx,
  ctx: DomainContext,
  fx: EffectsCollector,
  id: string,
): { id: string } {
  const row = transactionRepository.getById(tx, ctx.userId, id);
  if (!row) throw new NotFoundError('Transaccion', id);
  const account = accountRepository.getById(tx, ctx.userId, row.accountId);
  if (account && account.archivedAt !== null) throw new AccountArchivedError(account.id);
  transactionRepository.delete(tx, ctx.userId, id);
  fx.refresh('accounts', 'transactions', 'statement');
  if (row.debtId !== null) fx.refresh('debts');
  if (row.recurringItemId !== null && row.occurrenceDate !== null) {
    const recurring = recurringRepository.getById(tx, ctx.userId, row.recurringItemId);
    if (
      recurring &&
      recurring.anchorDate !== null &&
      isOccurrenceOfSeries(recurring.anchorDate, recurring.frequency, row.occurrenceDate)
    ) {
      const next =
        recurring.nextDueDate === null || row.occurrenceDate < recurring.nextDueDate
          ? row.occurrenceDate
          : recurring.nextDueDate;
      recurringRepository.update(tx, ctx.userId, recurring.id, {
        nextDueDate: next,
        snoozedUntil: null,
        now: ctx.now(),
      });
      fx.reschedule(recurring.id);
    }
  }
  return { id };
}

export function createTransactionService(ctx: DomainContext) {
  function resolveCategory(
    tx: DbOrTx,
    type: CategoryType,
    categoryId: string | null | undefined,
    newName: string | undefined,
  ): string | null {
    if (categoryId && newName !== undefined) {
      throw new ValidationError('Indica categoryId o newCategoryName, no ambos');
    }
    if (newName !== undefined) {
      const name = cleanName(newName, 'El nombre de la categoria');
      const existing = categoryRepository.findByName(tx, ctx.userId, type, name);
      if (existing) return existing.id;
      return categoryRepository.insert(tx, {
        userId: ctx.userId,
        name,
        type,
        order: categoryRepository.maxOrder(tx, ctx.userId, type) + 1,
        now: ctx.now(),
      });
    }
    if (categoryId) {
      const category = categoryRepository.getById(tx, ctx.userId, categoryId);
      if (!category) throw new NotFoundError('Categoria', categoryId);
      if (category.type !== type) throw new ValidationError('La categoria no corresponde al tipo de movimiento');
      return category.id;
    }
    return null;
  }

  return {
    /** Siempre `kind='STANDARD'`: los pagos de deuda solo entran por DebtService. */
    create(input: CreateTransactionInput): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        assertPositiveMinor(input.amountMinor, 'El monto');
        const isPassive = input.isPassive ?? false;
        if (isPassive && input.type !== 'INCOME') {
          throw new ValidationError('Solo un ingreso puede ser pasivo');
        }
        const date = input.date ?? ctx.now();
        assertEpochMs(date, 'La fecha');
        requireActiveAccount(tx, ctx.userId, input.accountId);
        const categoryId = resolveCategory(tx, input.type, input.categoryId, input.newCategoryName);
        const id = transactionRepository.insert(tx, {
          userId: ctx.userId,
          accountId: input.accountId,
          type: input.type,
          kind: 'STANDARD',
          amountMinor: input.amountMinor,
          description: input.description?.trim() ?? '',
          date,
          categoryId,
          isPassive,
          now: ctx.now(),
        });
        fx.refresh('accounts', 'transactions', 'statement');
        if (isPassive && autoActivateWidget(tx, ctx, 'cashflow')) fx.refresh('settings');
        return { id };
      });
    },

    /**
     * Edita una transaccion STANDARD. `DEBT_PAYMENT` no se edita (`TransactionNotEditableError` 'DEBT_PAYMENT');
     * la que confirma una ocurrencia recurrente admite todo menos una fecha distinta
     * (`TransactionNotEditableError` 'RECURRING_DATE'). La cuenta actual o la nueva archivada lanzan
     * `AccountArchivedError`. Saldos y reportes se rederivan solos.
     */
    update(id: string, input: UpdateTransactionInput): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        const row = transactionRepository.getById(tx, ctx.userId, id);
        if (!row) throw new NotFoundError('Transaccion', id);
        if (row.kind === 'DEBT_PAYMENT') throw new TransactionNotEditableError(id, 'DEBT_PAYMENT');
        const amountMinor = input.amountMinor ?? row.amountMinor;
        assertPositiveMinor(amountMinor, 'El monto');
        const date = input.date ?? row.date;
        assertEpochMs(date, 'La fecha');
        if (row.recurringItemId !== null && date !== row.date) {
          throw new TransactionNotEditableError(id, 'RECURRING_DATE');
        }
        const current = accountRepository.getById(tx, ctx.userId, row.accountId);
        if (current && current.archivedAt !== null) throw new AccountArchivedError(current.id);
        const accountId = input.accountId ?? row.accountId;
        if (accountId !== row.accountId) requireActiveAccount(tx, ctx.userId, accountId);
        const isPassive = row.type === 'INCOME' ? (input.isPassive ?? row.isPassive) : false;
        const categoryId =
          input.categoryId === undefined && input.newCategoryName === undefined
            ? row.categoryId
            : resolveCategory(tx, row.type, input.categoryId, input.newCategoryName);
        transactionRepository.update(tx, ctx.userId, id, {
          accountId,
          amountMinor,
          description: input.description === undefined ? row.description : input.description.trim(),
          date,
          categoryId,
          isPassive,
          now: ctx.now(),
        });
        fx.refresh('accounts', 'transactions', 'statement');
        if (isPassive && autoActivateWidget(tx, ctx, 'cashflow')) fx.refresh('settings');
        return { id };
      });
    },

    /** Saldo de cuenta, de deuda, paidCount y reportes se revierten solos (derivados). */
    remove(id: string): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => removeTransactionIn(tx, ctx, fx, id));
    },

    // --- Consultas (solo lectura) -------------------------------------------

    list(filters: TransactionFilters = {}): TransactionView[] {
      return transactionRepository.list(ctx.db, ctx.userId, filters);
    },

    get(id: string): TransactionView | undefined {
      return transactionRepository.getViewById(ctx.db, ctx.userId, id);
    },

    /** Categorias activas (base + del usuario) para los selectores. */
    categories(type?: CategoryType) {
      return categoryRepository.listActive(ctx.db, ctx.userId, type);
    },
  };
}

export type TransactionService = ReturnType<typeof createTransactionService>;
