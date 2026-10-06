import { categoryRepository } from '../../database/repositories/categoryRepository';
import { debtRepository } from '../../database/repositories/debtRepository';
import {
  recurringRepository,
  type RecurringFrequency,
  type RecurringRow,
} from '../../database/repositories/recurringRepository';
import { settingsRepository } from '../../database/repositories/settingsRepository';
import { transactionRepository } from '../../database/repositories/transactionRepository';
import type { DbOrTx } from '../../database/types';
import { addDays, localDateToEpochMs, toLocalDate, type LocalDate } from '../dates';
import type { PendingOccurrence } from '../rules/notificationPlan';
import { nextPendingOccurrence, normalizeAnchor } from '../rules/recurrence';
import {
  AccountRequiredError,
  NotFoundError,
  NotSupportedError,
  OccurrenceAlreadyConfirmedError,
  UseDebtPaymentFlow,
  ValidationError,
} from './errors';
import {
  assertEpochMs,
  assertLocalDate,
  assertPositiveMinor,
  autoActivateWidget,
  cleanName,
  requireActiveAccount,
  runOperation,
  type DomainContext,
  type EffectsCollector,
  type OperationResult,
} from './shared';
import { removeTransactionIn } from './TransactionService';

export interface CreateRecurringInput {
  type: 'INCOME' | 'EXPENSE';
  name: string;
  amountMinor: number;
  /** Solo ingresos; activa el Indice (SUPUESTO de la arquitectura). */
  isPassive?: boolean;
  categoryId?: string | null;
  /** Solo sugerencia: al confirmar siempre se pide cuenta (D8). */
  defaultAccountId?: string | null;
  frequency: RecurringFrequency;
  /** Primera fecha 'YYYY-MM-DD'. Se guarda NORMALIZADA (BIWEEKLY -> 15 o ultimo dia). NULL = sin fecha. */
  anchorDate?: LocalDate | null;
}

export interface UpdateRecurringInput {
  name?: string;
  amountMinor?: number;
  isPassive?: boolean;
  categoryId?: string | null;
  defaultAccountId?: string | null;
  frequency?: RecurringFrequency;
  /** Nueva primera fecha; NULL deja el recurrente "sin fecha". */
  anchorDate?: LocalDate | null;
}

export interface ConfirmOccurrenceInput {
  recurringId: string;
  occurrenceDate: LocalDate;
  /** Obligatorio: la hoja "Ya pague" siempre pide cuenta. */
  accountId: string;
  /** Por defecto, el monto del recurrente. */
  amountMinor?: number;
  /** Epoch ms; por defecto el reloj del dominio. */
  date?: number;
}

export type UpcomingStatus = 'PENDING' | 'OVERDUE' | 'PAID';

export interface UpcomingItem {
  recurringId: string;
  kind: RecurringRow['kind'];
  type: RecurringRow['type'];
  /** Para cuotas de deuda, el nombre de la deuda. */
  name: string;
  /** Para cuotas de deuda, la cuota de la deuda (puede ser null si esta "sin definir"). */
  amountMinor: number | null;
  isPassive: boolean;
  debtId: string | null;
  defaultAccountId: string | null;
  frequency: RecurringFrequency;
  nextDueDate: LocalDate;
  /** Epoch ms o null. */
  snoozedUntil: number | null;
  status: UpcomingStatus;
}

// ----------------------------------------------------------------------------
// Internos compartidos (misma transaccion): creacion y avance de fecha
// ----------------------------------------------------------------------------

/** Crea un recurrente STANDARD con el ancla ya normalizada. Compartido con OnboardingService. */
export function createStandardRecurringIn(
  tx: DbOrTx,
  ctx: DomainContext,
  fx: EffectsCollector,
  input: CreateRecurringInput,
): string {
  const name = cleanName(input.name, 'El nombre del recurrente');
  assertPositiveMinor(input.amountMinor, 'El monto');
  const isPassive = input.isPassive ?? false;
  if (isPassive && input.type !== 'INCOME') throw new ValidationError('Solo un ingreso puede ser pasivo');
  if (input.categoryId) {
    const category = categoryRepository.getById(tx, input.categoryId);
    if (!category) throw new NotFoundError('Categoria', input.categoryId);
    if (category.type !== input.type) throw new ValidationError('La categoria no corresponde al tipo');
  }
  if (input.defaultAccountId) requireActiveAccount(tx, input.defaultAccountId);

  let anchor: LocalDate | null = null;
  if (input.anchorDate) {
    anchor = normalizeAnchor(assertLocalDate(input.anchorDate, 'La fecha'), input.frequency).date;
  }
  const id = recurringRepository.insert(tx, {
    userId: ctx.userId,
    type: input.type,
    kind: 'STANDARD',
    name,
    amountMinor: input.amountMinor,
    isPassive,
    categoryId: input.categoryId ?? null,
    defaultAccountId: input.defaultAccountId ?? null,
    frequency: input.frequency,
    anchorDate: anchor,
    nextDueDate: anchor,
    now: ctx.now(),
  });
  fx.reschedule(id);
  if (isPassive && autoActivateWidget(tx, ctx, 'cashflow')) fx.refresh('settings');
  return id;
}

/**
 * Tras confirmar `occurrence` (la transaccion ya esta insertada): si era la proxima pendiente,
 * `nextDueDate` pasa a la primera ocurrencia POSTERIOR sin transaccion ligada, calculada desde el
 * ancla (nunca desde "ahora"), y se limpia `snoozedUntil`.
 */
export function advanceAfterConfirm(
  tx: DbOrTx,
  ctx: DomainContext,
  fx: EffectsCollector,
  recurring: RecurringRow,
  occurrence: LocalDate,
): void {
  fx.reschedule(recurring.id);
  if (recurring.anchorDate === null || recurring.nextDueDate !== occurrence) return;
  const next = nextPendingOccurrence({
    anchor: recurring.anchorDate,
    frequency: recurring.frequency,
    confirmed: transactionRepository.confirmedOccurrences(tx, recurring.id),
    minDate: addDays(occurrence, 1),
  });
  if (next === null) return;
  recurringRepository.update(tx, recurring.id, { nextDueDate: next, snoozedUntil: null, now: ctx.now() });
}

export function createRecurringService(ctx: DomainContext) {
  function requireStandard(tx: DbOrTx, id: string): RecurringRow {
    const row = recurringRepository.getById(tx, id);
    if (!row) throw new NotFoundError('Recurrente', id);
    if (row.kind !== 'STANDARD') {
      throw new NotSupportedError('La cuota de una deuda se gestiona desde DebtService');
    }
    return row;
  }

  return {
    create(input: CreateRecurringInput): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => ({ id: createStandardRecurringIn(tx, ctx, fx, input) }));
    },

    /**
     * Cambiar frecuencia o fecha reubica `nextDueDate` en la primera ocurrencia sin transaccion
     * desde la nueva ancla (normalizada) y limpia `snoozedUntil`.
     */
    update(id: string, input: UpdateRecurringInput): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        const row = requireStandard(tx, id);
        const frequency = input.frequency ?? row.frequency;
        const isPassive = input.isPassive ?? row.isPassive;
        if (isPassive && row.type !== 'INCOME') throw new ValidationError('Solo un ingreso puede ser pasivo');
        if (input.amountMinor !== undefined) assertPositiveMinor(input.amountMinor, 'El monto');
        if (input.categoryId) {
          const category = categoryRepository.getById(tx, input.categoryId);
          if (!category) throw new NotFoundError('Categoria', input.categoryId);
          if (category.type !== row.type) throw new ValidationError('La categoria no corresponde al tipo');
        }
        if (input.defaultAccountId) requireActiveAccount(tx, input.defaultAccountId);

        const anchorInput = input.anchorDate !== undefined ? input.anchorDate : row.anchorDate;
        const scheduleChanged = input.anchorDate !== undefined || frequency !== row.frequency;
        let anchor: LocalDate | null = null;
        if (anchorInput) anchor = normalizeAnchor(assertLocalDate(anchorInput, 'La fecha'), frequency).date;

        let nextDueDate: LocalDate | null | undefined;
        if (scheduleChanged) {
          nextDueDate =
            anchor === null
              ? null
              : nextPendingOccurrence({
                  anchor,
                  frequency,
                  confirmed: transactionRepository.confirmedOccurrences(tx, id),
                  minDate: anchor,
                });
        }

        recurringRepository.update(tx, id, {
          name: input.name !== undefined ? cleanName(input.name, 'El nombre del recurrente') : undefined,
          amountMinor: input.amountMinor,
          isPassive: input.isPassive,
          categoryId: input.categoryId,
          defaultAccountId: input.defaultAccountId,
          frequency: scheduleChanged ? frequency : undefined,
          anchorDate: scheduleChanged ? anchor : undefined,
          nextDueDate,
          snoozedUntil: scheduleChanged ? null : undefined,
          now: ctx.now(),
        });
        fx.reschedule(id);
        if (isPassive && autoActivateWidget(tx, ctx, 'cashflow')) fx.refresh('settings');
        return { id };
      });
    },

    /** Las transacciones ligadas quedan con `recurringItemId` NULL. */
    remove(id: string): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        requireStandard(tx, id);
        transactionRepository.unlinkRecurring(tx, id);
        recurringRepository.delete(tx, id);
        fx.reschedule(id);
        fx.refresh('transactions');
        return { id };
      });
    },

    /**
     * Confirma una ocurrencia creando una Transaction REAL. Si el recurrente es la cuota de una deuda
     * lanza `UseDebtPaymentFlow` (I4): ese camino es `DebtService.registerPayment`.
     */
    confirmOccurrence(input: ConfirmOccurrenceInput): OperationResult<{ transactionId: string }> {
      return runOperation(ctx, (tx, fx) => {
        const recurring = recurringRepository.getById(tx, input.recurringId);
        if (!recurring) throw new NotFoundError('Recurrente', input.recurringId);
        if (recurring.kind === 'DEBT_INSTALLMENT' && recurring.debtId !== null) {
          throw new UseDebtPaymentFlow(recurring.debtId, recurring.id, input.occurrenceDate);
        }
        if (!input.accountId) throw new AccountRequiredError();
        assertLocalDate(input.occurrenceDate, 'La ocurrencia');
        requireActiveAccount(tx, input.accountId);
        if (transactionRepository.findByOccurrence(tx, recurring.id, input.occurrenceDate)) {
          throw new OccurrenceAlreadyConfirmedError(recurring.id, input.occurrenceDate);
        }
        const amountMinor = input.amountMinor ?? recurring.amountMinor;
        if (amountMinor === null) throw new ValidationError('El recurrente no tiene monto');
        assertPositiveMinor(amountMinor, 'El monto');
        const date = input.date ?? ctx.now();
        assertEpochMs(date, 'La fecha');

        const transactionId = transactionRepository.insert(tx, {
          userId: ctx.userId,
          accountId: input.accountId,
          type: recurring.type,
          kind: 'STANDARD',
          amountMinor,
          description: recurring.name ?? '',
          date,
          categoryId: recurring.categoryId,
          isPassive: recurring.isPassive,
          recurringItemId: recurring.id,
          occurrenceDate: input.occurrenceDate,
          now: ctx.now(),
        });
        advanceAfterConfirm(tx, ctx, fx, recurring, input.occurrenceDate);
        fx.refresh('accounts', 'transactions', 'statement');
        if (recurring.isPassive && autoActivateWidget(tx, ctx, 'cashflow')) fx.refresh('settings');
        return { transactionId };
      });
    },

    /** Desmarcar el circulo en Proximos pagos: delega en el unico camino de reversion (D14). */
    unconfirm(recurringId: string, occurrenceDate: LocalDate): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        const row = transactionRepository.findByOccurrence(tx, recurringId, occurrenceDate);
        if (!row) throw new NotFoundError('Ocurrencia confirmada', `${recurringId}@${occurrenceDate}`);
        return removeTransactionIn(tx, ctx, fx, row.id);
      });
    },

    /** "Todavia no": proximo aviso = dia siguiente a `reminderHour` (§7, D5). */
    snooze(recurringId: string): OperationResult<{ snoozedUntil: number }> {
      return runOperation(ctx, (tx, fx) => {
        const recurring = recurringRepository.getById(tx, recurringId);
        if (!recurring) throw new NotFoundError('Recurrente', recurringId);
        const settings = settingsRepository.get(tx, ctx.userId);
        const hour = settings?.reminderHour ?? 9;
        const tomorrow = addDays(toLocalDate(ctx.now()), 1);
        const snoozedUntil = localDateToEpochMs(tomorrow, hour);
        recurringRepository.update(tx, recurringId, { snoozedUntil, now: ctx.now() });
        fx.reschedule(recurringId);
        return { snoozedUntil };
      });
    },

    // --- Consultas (solo lectura) -------------------------------------------

    /** Recurrentes STANDARD (pantalla de gestion). */
    list(): RecurringRow[] {
      return recurringRepository.listStandard(ctx.db, ctx.userId);
    },

    /**
     * Proximos pagos: recurrentes activos con fecha, sin las cuotas de deudas con saldo 0 o archivadas.
     * Estado: PAID (hay transaccion de una ocurrencia del mes actual y la siguiente fecha cae fuera del
     * mes; SUPUESTO de presentacion), OVERDUE (fecha pasada) o PENDING.
     */
    upcoming(): UpcomingItem[] {
      const db = ctx.db;
      const today = toLocalDate(ctx.now());
      const month = today.slice(0, 7);
      const debts = new Map(debtRepository.list(db, ctx.userId, true).map((d) => [d.id, d]));
      const balances = debtRepository.balancesByDebt(db, ctx.userId);
      const items: UpcomingItem[] = [];
      for (const r of recurringRepository.listActiveDated(db, ctx.userId)) {
        const nextDueDate = r.nextDueDate as LocalDate;
        let name = r.name ?? '';
        let amountMinor = r.amountMinor;
        if (r.kind === 'DEBT_INSTALLMENT' && r.debtId !== null) {
          const debt = debts.get(r.debtId);
          if (!debt || debt.archivedAt !== null || (balances.get(debt.id) ?? 0) <= 0) continue;
          name = debt.name;
          amountMinor = debt.installmentMinor;
        }
        const paidThisMonth =
          !nextDueDate.startsWith(month) &&
          transactionRepository.confirmedOccurrences(db, r.id).some((o) => o.startsWith(month));
        const status: UpcomingStatus = paidThisMonth ? 'PAID' : nextDueDate < today ? 'OVERDUE' : 'PENDING';
        items.push({
          recurringId: r.id,
          kind: r.kind,
          type: r.type,
          name,
          amountMinor,
          isPassive: r.isPassive,
          debtId: r.debtId,
          defaultAccountId: r.defaultAccountId,
          frequency: r.frequency,
          nextDueDate,
          snoozedUntil: r.snoozedUntil,
          status,
        });
      }
      return items;
    },

    /**
     * Entrada de `planNotifications` (F4): recurrentes activos con fecha. Los instantes salen como
     * epoch ms (`number`), no como `Date`. Las cuotas de deudas liquidadas van marcadas `debtSettled`.
     */
    pendingOccurrences(): PendingOccurrence[] {
      const db = ctx.db;
      const debts = new Map(debtRepository.list(db, ctx.userId, true).map((d) => [d.id, d]));
      const balances = debtRepository.balancesByDebt(db, ctx.userId);
      const out: PendingOccurrence[] = [];
      for (const r of recurringRepository.listActiveDated(db, ctx.userId)) {
        let name = r.name ?? '';
        let amount = r.amountMinor;
        let debtSettled = false;
        if (r.kind === 'DEBT_INSTALLMENT' && r.debtId !== null) {
          const debt = debts.get(r.debtId);
          if (!debt) continue;
          name = debt.name;
          amount = debt.installmentMinor;
          debtSettled = debt.archivedAt !== null || (balances.get(debt.id) ?? 0) <= 0;
        }
        out.push({
          recurringId: r.id,
          occurrence: r.nextDueDate as LocalDate,
          name,
          amount,
          direction: r.type,
          debtId: r.debtId,
          debtSettled,
          snoozedUntil: r.snoozedUntil,
        });
      }
      return out;
    },
  };
}

export type RecurringService = ReturnType<typeof createRecurringService>;
