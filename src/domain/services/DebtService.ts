import { adjustmentRepository } from '../../database/repositories/adjustmentRepository';
import { debtRepository, type DebtRow, type RateSource } from '../../database/repositories/debtRepository';
import { recurringRepository } from '../../database/repositories/recurringRepository';
import { transactionRepository, type TransactionRow } from '../../database/repositories/transactionRepository';
import type { DbOrTx } from '../../database/types';
import type { LocalDate } from '../dates';
import { estimateMonthlyRate, remainingMonths } from '../rules/amortization';
import { isOccurrenceOfSeries, nextPendingOccurrence } from '../rules/recurrence';
import { debtPaymentEffect, paidCount } from '../rules/statement';
import {
  DebtArchivedError,
  DebtSettledError,
  NotFoundError,
  OccurrenceAlreadyConfirmedError,
  OccurrenceNotInSeriesError,
  ValidationError,
} from './errors';
import { advanceAfterConfirm } from './RecurringService';
import {
  assertEpochMs,
  assertLocalDate,
  assertNonNegativeMinor,
  assertPositiveMinor,
  autoActivateWidget,
  cleanName,
  requireActiveAccount,
  runOperation,
  type DomainContext,
  type EffectsCollector,
  type OperationResult,
} from './shared';

export interface CreateDebtInput {
  name: string;
  /** Saldo actual (>= 0; el ajuste OPENING solo se crea si es > 0). */
  balanceMinor: number;
  installmentMinor?: number | null;
  /** `known`: tasa mensual decimal (0.02 = 2%). `unknown`: se estima con `estimateMonthlyRate`. */
  rate: { known: number } | { unknown: { months: number } };
  /** Fecha del proximo pago. Solo crea el recurrente si tambien hay cuota. */
  nextDueDate?: LocalDate | null;
  /** Cuotas ya pagadas antes de usar la app (SUPUESTO: opcional, 0 por defecto). */
  initialPaidCount?: number;
}

export interface UpdateDebtInput {
  name?: string;
  /** Nuevo saldo: ajuste MANUAL con nuevo >= 0. */
  balanceMinor?: number;
  installmentMinor?: number | null;
  /**
   * Actualiza o crea el recurrente vinculado (requiere cuota). La fecha dada pasa a ser el ANCLA;
   * `nextDueDate` queda en la primera ocurrencia desde el ancla que no tenga transaccion ligada
   * (puede ser posterior a la fecha dada si esa ocurrencia ya estaba pagada).
   */
  nextDueDate?: LocalDate;
}

export interface RegisterPaymentInput {
  debtId: string;
  accountId: string;
  /** Monto completo del pago: siempre es el gasto, aunque supere el saldo. */
  amountMinor: number;
  type: 'INSTALLMENT' | 'EXTRA';
  /** Epoch ms; por defecto el reloj del dominio. */
  date?: number;
  /** Ocurrencia que cubre una cuota (por defecto, la `nextDueDate` del recurrente vinculado). */
  occurrenceDate?: LocalDate;
  description?: string;
}

export interface RegisterPaymentResult {
  transactionId: string;
  principalAppliedMinor: number;
  overpaymentMinor: number;
  newBalanceMinor: number;
  /** true si el pago se ligo a una ocurrencia del recurrente y avanzo `nextDueDate`. */
  linkedToOccurrence: boolean;
}

export interface DebtView extends DebtRow {
  /** Saldo derivado (>= 0). */
  balanceMinor: number;
  /** initialPaidCount + cuotas (INSTALLMENT) registradas. */
  paidCount: number;
  /** Fecha del proximo pago (del recurrente vinculado) o null. */
  nextDueDate: LocalDate | null;
  recurringId: string | null;
  /** Meses restantes (D16); null sin cuota o si nunca se liquida. */
  monthsRemaining: number | null;
}

export type RemoveDebtOutcome = 'DELETED' | 'ARCHIVED';

function createInstallmentRecurring(tx: DbOrTx, ctx: DomainContext, debtId: string, date: LocalDate): string {
  return recurringRepository.insert(tx, {
    userId: ctx.userId,
    type: 'EXPENSE',
    kind: 'DEBT_INSTALLMENT',
    debtId,
    name: null,
    amountMinor: null,
    // SUPUESTO: la cuota de una deuda es mensual (la arquitectura no define la frecuencia).
    frequency: 'MONTHLY',
    anchorDate: date,
    nextDueDate: date,
    now: ctx.now(),
  });
}

export function createDebtService(ctx: DomainContext) {
  function requireActiveDebt(tx: DbOrTx, id: string): DebtRow {
    const debt = debtRepository.getById(tx, id);
    if (!debt) throw new NotFoundError('Deuda', id);
    if (debt.archivedAt !== null) throw new DebtArchivedError(id);
    return debt;
  }

  function toView(
    debt: DebtRow,
    balance: number,
    installments: number,
    recurring: { id: string; nextDueDate: string | null } | undefined,
  ): DebtView {
    const paid = paidCount(debt.initialPaidCount, installments);
    return {
      ...debt,
      balanceMinor: balance,
      paidCount: paid,
      nextDueDate: recurring?.nextDueDate ?? null,
      recurringId: recurring?.id ?? null,
      monthsRemaining: remainingMonths({
        saldo: balance,
        cuota: debt.installmentMinor,
        tasa: debt.monthlyRate,
        totalCount: debt.totalCount,
        paidCount: paid,
      }),
    };
  }

  return {
    create(input: CreateDebtInput): OperationResult<{ id: string; recurringId: string | null }> {
      return runOperation(ctx, (tx, fx: EffectsCollector) => {
        const name = cleanName(input.name, 'El nombre de la deuda');
        assertNonNegativeMinor(input.balanceMinor, 'El saldo');
        const installment = input.installmentMinor ?? null;
        if (installment !== null) assertPositiveMinor(installment, 'La cuota');
        const initialPaid = input.initialPaidCount ?? 0;
        assertNonNegativeMinor(initialPaid, 'Las cuotas pagadas');
        const nextDue = input.nextDueDate ? assertLocalDate(input.nextDueDate, 'La fecha de pago') : null;

        let monthlyRate: number | null;
        let rateSource: RateSource;
        let totalCount: number | null;
        if ('known' in input.rate) {
          if (!Number.isFinite(input.rate.known) || input.rate.known < 0) {
            throw new ValidationError('La tasa mensual debe ser un numero >= 0');
          }
          monthlyRate = input.rate.known;
          rateSource = 'KNOWN';
          totalCount = null;
        } else {
          const months = input.rate.unknown.months;
          assertPositiveMinor(months, 'Los meses');
          totalCount = months;
          const estimated =
            installment !== null && input.balanceMinor > 0
              ? estimateMonthlyRate(input.balanceMinor, installment, months)
              : null;
          // SUPUESTO: si no hay solucion (sin cuota, o cuota x meses <= saldo) la tasa queda desconocida.
          monthlyRate = estimated;
          rateSource = estimated === null ? 'UNKNOWN' : 'ESTIMATED';
        }

        const id = debtRepository.insert(tx, {
          userId: ctx.userId,
          name,
          installmentMinor: installment,
          monthlyRate,
          rateSource,
          initialPaidCount: initialPaid,
          totalCount,
          now: ctx.now(),
        });
        if (input.balanceMinor > 0) {
          adjustmentRepository.insert(tx, {
            userId: ctx.userId,
            target: { type: 'DEBT', id },
            previousMinor: 0,
            newMinor: input.balanceMinor,
            reason: 'OPENING',
            now: ctx.now(),
          });
        }
        let recurringId: string | null = null;
        if (installment !== null && nextDue !== null) {
          recurringId = createInstallmentRecurring(tx, ctx, id, nextDue);
          fx.reschedule(recurringId);
        }
        fx.refresh('debts');
        if (autoActivateWidget(tx, ctx, 'debts')) fx.refresh('settings');
        return { id, recurringId };
      });
    },

    update(id: string, input: UpdateDebtInput): OperationResult<{ adjusted: boolean }> {
      return runOperation(ctx, (tx, fx) => {
        const debt = requireActiveDebt(tx, id);
        const now = ctx.now();
        let installment: number | null | undefined;
        if (input.installmentMinor !== undefined) {
          if (input.installmentMinor !== null) assertPositiveMinor(input.installmentMinor, 'La cuota');
          installment = input.installmentMinor;
        }
        debtRepository.update(tx, id, {
          name: input.name !== undefined ? cleanName(input.name, 'El nombre de la deuda') : undefined,
          installmentMinor: installment,
          now,
        });

        let adjusted = false;
        if (input.balanceMinor !== undefined) {
          assertNonNegativeMinor(input.balanceMinor, 'El saldo');
          const current = debtRepository.balanceOf(tx, id);
          if (input.balanceMinor !== current) {
            adjustmentRepository.insert(tx, {
              userId: ctx.userId,
              target: { type: 'DEBT', id },
              previousMinor: current,
              newMinor: input.balanceMinor,
              reason: 'MANUAL',
              now,
            });
            adjusted = true;
          }
        }

        if (input.nextDueDate !== undefined) {
          const date = assertLocalDate(input.nextDueDate, 'La fecha de pago');
          const existing = recurringRepository.getByDebtId(tx, id);
          if (existing) {
            // El ancla es la fecha dada; nextDueDate, la primera ocurrencia desde el ancla sin
            // transaccion ligada (igual que el avance normal y RecurringService.update).
            const nextDueDate =
              nextPendingOccurrence({
                anchor: date,
                frequency: existing.frequency,
                confirmed: transactionRepository.confirmedOccurrences(tx, existing.id),
                minDate: date,
              }) ?? date;
            recurringRepository.update(tx, existing.id, {
              anchorDate: date,
              nextDueDate,
              snoozedUntil: null,
              now,
            });
            fx.reschedule(existing.id);
          } else {
            const effectiveInstallment = installment !== undefined ? installment : debt.installmentMinor;
            if (effectiveInstallment === null) {
              throw new ValidationError('Para fijar la fecha de pago hay que definir la cuota');
            }
            fx.reschedule(createInstallmentRecurring(tx, ctx, id, date));
          }
        }
        fx.refresh('debts');
        return { adjusted };
      });
    },

    /**
     * Pago de deuda = gasto real. Capital aplicado = min(monto, saldo); la transaccion guarda el monto
     * COMPLETO (un abono mayor al saldo deja la deuda en 0 y cuenta completo como gasto).
     *
     * Cuota (`INSTALLMENT`) con recurrente vinculado: cubre `occurrenceDate` si se pasa (debe ser de la
     * serie) o, si no, la `nextDueDate`. Si el recurrente NO tiene fecha (`nextDueDate` NULL):
     *   - sin `occurrenceDate`: el pago se registra SIN ligar a ninguna ocurrencia (`linkedToOccurrence`
     *     false);
     *   - con `occurrenceDate` explicita: sin ancla nunca pertenece a la serie y se lanza
     *     `OccurrenceNotInSeriesError` (una ocurrencia ajena a la serie nunca se acepta). SUPUESTO: con
     *     ancla pero sin `nextDueDate`, una ocurrencia explicita de la serie si se liga.
     * `EXTRA` ignora `occurrenceDate` (no es cuota).
     *
     * ORDEN DE VALIDACIONES (fijado por tests; el primer error que aplique es el que se lanza):
     *   1 deuda inexistente (`NotFoundError`) o archivada (`DebtArchivedError`), 2 monto
     *   (`ValidationError`), 3 cuenta inexistente o archivada (`NotFoundError` / `AccountArchivedError`),
     *   4 fecha del pago fuera de rango (`ValidationError`), 5 deuda liquidada (`DebtSettledError`),
     *   6 `occurrenceDate` mal formada o con anio < 100 (`ValidationError`), 7 fuera de la serie
     *   (`OccurrenceNotInSeriesError`), 8 ya confirmada (`OccurrenceAlreadyConfirmedError`).
     */
    registerPayment(input: RegisterPaymentInput): OperationResult<RegisterPaymentResult> {
      return runOperation(ctx, (tx, fx) => {
        const debt = requireActiveDebt(tx, input.debtId);
        assertPositiveMinor(input.amountMinor, 'El monto');
        requireActiveAccount(tx, input.accountId);
        const date = input.date ?? ctx.now();
        assertEpochMs(date, 'La fecha');
        const balance = debtRepository.balanceOf(tx, debt.id);
        if (balance <= 0) throw new DebtSettledError(debt.id);
        const effect = debtPaymentEffect(input.amountMinor, balance);

        const recurring = input.type === 'INSTALLMENT' ? recurringRepository.getByDebtId(tx, debt.id) : undefined;
        // Ocurrencia que cubre la cuota: la explicita (validada contra la serie) o la `nextDueDate`.
        let occurrence: LocalDate | null = null;
        if (recurring !== undefined) {
          if (input.occurrenceDate !== undefined) {
            occurrence = assertLocalDate(input.occurrenceDate, 'La ocurrencia');
            // Sin ancla no hay serie: una ocurrencia explicita nunca es "de la serie".
            if (
              recurring.anchorDate === null ||
              !isOccurrenceOfSeries(recurring.anchorDate, recurring.frequency, occurrence)
            ) {
              throw new OccurrenceNotInSeriesError(recurring.id, occurrence);
            }
          } else {
            occurrence = recurring.nextDueDate;
          }
          if (occurrence !== null && transactionRepository.findByOccurrence(tx, recurring.id, occurrence)) {
            throw new OccurrenceAlreadyConfirmedError(recurring.id, occurrence);
          }
        }
        const linked = recurring !== undefined && occurrence !== null;

        const transactionId = transactionRepository.insert(tx, {
          userId: ctx.userId,
          accountId: input.accountId,
          type: 'EXPENSE',
          kind: 'DEBT_PAYMENT',
          amountMinor: effect.expense,
          description: input.description?.trim() || `Pago ${debt.name}`,
          date,
          debtId: debt.id,
          debtPaymentType: input.type,
          debtPrincipalAppliedMinor: effect.principalApplied,
          recurringItemId: linked ? recurring.id : null,
          occurrenceDate: linked ? occurrence : null,
          now: ctx.now(),
        });
        if (linked && occurrence !== null) advanceAfterConfirm(tx, ctx, fx, recurring, occurrence);
        fx.refresh('accounts', 'transactions', 'debts', 'statement');
        return {
          transactionId,
          principalAppliedMinor: effect.principalApplied,
          overpaymentMinor: effect.overpayment,
          newBalanceMinor: effect.newBalance,
          linkedToOccurrence: linked,
        };
      });
    },

    /** Sin pagos: borrado real (ajustes y recurrente incluidos). Con pagos: se archiva (D3). */
    remove(id: string): OperationResult<{ outcome: RemoveDebtOutcome }> {
      return runOperation(ctx, (tx, fx) => {
        requireActiveDebt(tx, id);
        const recurring = recurringRepository.getByDebtId(tx, id);
        if (recurring) {
          transactionRepository.unlinkRecurring(tx, recurring.id);
          recurringRepository.delete(tx, recurring.id);
          fx.reschedule(recurring.id);
        }
        fx.refresh('debts');
        if (transactionRepository.countPaymentsOfDebt(tx, id) === 0) {
          adjustmentRepository.deleteFor(tx, { type: 'DEBT', id });
          debtRepository.delete(tx, id);
          return { outcome: 'DELETED' as const };
        }
        debtRepository.archive(tx, id, ctx.now());
        return { outcome: 'ARCHIVED' as const };
      });
    },

    // --- Consultas (solo lectura) -------------------------------------------

    /** Deudas no archivadas con saldo, paidCount, proxima fecha y meses restantes derivados. */
    list(): DebtView[] {
      const db = ctx.db;
      const balances = debtRepository.balancesByDebt(db, ctx.userId);
      const installments = debtRepository.installmentCountsByDebt(db, ctx.userId);
      return debtRepository.list(db, ctx.userId).map((d) => {
        const rec = recurringRepository.getByDebtId(db, d.id);
        return toView(d, balances.get(d.id) ?? 0, installments.get(d.id) ?? 0, rec);
      });
    },

    get(id: string): DebtView | undefined {
      const debt = debtRepository.getById(ctx.db, id);
      if (!debt) return undefined;
      return toView(
        debt,
        debtRepository.balanceOf(ctx.db, id),
        debtRepository.installmentPaymentCount(ctx.db, id),
        recurringRepository.getByDebtId(ctx.db, id),
      );
    },

    /** Pagos de una deuda, del mas reciente al mas antiguo. */
    payments(debtId: string): TransactionRow[] {
      return transactionRepository.listPaymentsOfDebt(ctx.db, debtId);
    },
  };
}

export type DebtService = ReturnType<typeof createDebtService>;
