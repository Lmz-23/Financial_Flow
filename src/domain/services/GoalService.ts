import { accountRepository } from '../../database/repositories/accountRepository';
import { adjustmentRepository } from '../../database/repositories/adjustmentRepository';
import { goalContributionRepository } from '../../database/repositories/goalContributionRepository';
import { goalRepository, type GoalRow, type GoalStatus } from '../../database/repositories/goalRepository';
import type { DbOrTx } from '../../database/types';
import { localDateToEpochMs, toLocalDate, type LocalDate } from '../dates';
import { goalEta, type GoalEta } from '../rules/goalEta';
import {
  GoalNotActiveError,
  GoalNotReachedError,
  InsufficientFundsError,
  NotFoundError,
  RefundAccountRequiredError,
  ValidationError,
  type ArchivedRefundSource,
} from './errors';
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
  type OperationResult,
} from './shared';

export interface CreateGoalInput {
  name: string;
  targetMinor: number;
  /** Ahorro inicial: es un APORTE desde `accountId` (no un ajuste). */
  initialMinor?: number;
  accountId?: string;
  /** Fecha objetivo 'YYYY-MM-DD' (local); se guarda como medianoche local en epoch ms. */
  targetDate?: LocalDate | null;
}

export interface ContributeInput {
  goalId: string;
  accountId: string;
  amountMinor: number;
  /** Epoch ms; por defecto el reloj del dominio. */
  date?: number;
}

export interface UpdateGoalInput {
  name?: string;
  targetMinor?: number;
  /** Nuevo ahorro: ajuste MANUAL de la meta; no toca cuentas. */
  savedMinor?: number;
  /** Fecha objetivo 'YYYY-MM-DD' (local); `null` la limpia; sin definir, no cambia. */
  targetDate?: LocalDate | null;
}

export interface GoalView extends GoalRow {
  /** Ahorro derivado (aportes + ajustes). En una meta SPENT es la foto `spentAmountMinor`. */
  savedMinor: number;
  /** ETA (D20) calculado con `ctx.now()` y los aportes reales; null en metas SPENT. */
  eta: GoalEta | null;
}

export interface GoalRefund {
  accountId: string;
  accountName: string;
  amountMinor: number;
  /** true si la cuenta de origen esta archivada (su dinero exige elegir un destino activo). */
  accountArchived: boolean;
}

export interface RefundPreview {
  refunds: GoalRefund[];
  /** Suma de los aportes de cuentas archivadas: lo que hay que redirigir a una cuenta activa. */
  requiresDestinationMinor: number;
}

export interface RemoveGoalOptions {
  /** Cuenta ACTIVA que recibe el dinero de los aportes de cuentas archivadas. */
  refundAccountId?: string;
}

export interface RemoveGoalResult {
  refunds: GoalRefund[];
  /** Total redirigido a `refundAccountId` (0 si no habia aportes de cuentas archivadas). */
  redirectedMinor: number;
  refundAccountId: string | null;
}

export interface GoalContributionView {
  id: string;
  goalId: string;
  accountId: string;
  accountName: string;
  accountArchived: boolean;
  amountMinor: number;
  /** Epoch ms. */
  date: number;
}

function toSources(refunds: GoalRefund[]): ArchivedRefundSource[] {
  return refunds.map((r) => ({ accountId: r.accountId, accountName: r.accountName, amountMinor: r.amountMinor }));
}

export function createGoalService(ctx: DomainContext) {
  function requireActiveGoal(tx: DbOrTx, id: string): GoalRow {
    const goal = goalRepository.getById(tx, id);
    if (!goal) throw new NotFoundError('Meta', id);
    if (goal.status !== 'ACTIVE') throw new GoalNotActiveError(id);
    return goal;
  }

  /** Aporte con la regla D12 (no mas que el disponible). */
  function addContribution(
    tx: DbOrTx,
    goalId: string,
    accountId: string,
    amountMinor: number,
    date: number,
  ): string {
    assertPositiveMinor(amountMinor, 'El monto');
    assertEpochMs(date, 'La fecha');
    requireActiveAccount(tx, accountId);
    const available = accountRepository.availableOf(tx, accountId);
    if (amountMinor > available) throw new InsufficientFundsError(accountId, available, amountMinor);
    return goalContributionRepository.insert(tx, {
      userId: ctx.userId,
      goalId,
      accountId,
      amountMinor,
      date,
      now: ctx.now(),
    });
  }

  function refundsOf(db: DbOrTx, goalId: string): GoalRefund[] {
    return goalContributionRepository.totalsByAccount(db, goalId).map((r) => {
      const account = accountRepository.getById(db, r.accountId);
      return {
        accountId: r.accountId,
        accountName: account?.name ?? '',
        amountMinor: r.amountMinor,
        accountArchived: account !== undefined && account.archivedAt !== null,
      };
    });
  }

  function toLocalTarget(goal: GoalRow): LocalDate | null {
    return goal.targetDate === null ? null : toLocalDate(goal.targetDate);
  }

  /** Valida 'YYYY-MM-DD' y lo convierte a medianoche local (epoch ms); null se conserva. */
  function targetDateMs(value: LocalDate | null): number | null {
    if (value === null) return null;
    return localDateToEpochMs(assertLocalDate(value, 'La fecha objetivo'));
  }

  function viewOf(db: DbOrTx, g: GoalRow, savedActive: number): GoalView {
    if (g.status === 'SPENT') return { ...g, savedMinor: g.spentAmountMinor ?? 0, eta: null };
    const contributions = goalContributionRepository
      .listByGoal(db, g.id)
      .map((c) => ({ date: c.date, amountMinor: c.amountMinor }));
    const eta = goalEta({
      contributions,
      savedMinor: savedActive,
      targetMinor: g.targetMinor,
      targetDate: toLocalTarget(g),
      now: ctx.now(),
    });
    return { ...g, savedMinor: savedActive, eta };
  }

  return {
    create(input: CreateGoalInput): OperationResult<{ id: string; contributionId: string | null }> {
      return runOperation(ctx, (tx, fx) => {
        const name = cleanName(input.name, 'El nombre de la meta');
        assertPositiveMinor(input.targetMinor, 'El objetivo');
        const initial = input.initialMinor ?? 0;
        assertNonNegativeMinor(initial, 'El ahorro inicial');
        if (initial > 0 && !input.accountId) {
          throw new ValidationError('El ahorro inicial sale de una cuenta: indica accountId');
        }
        const targetDate = targetDateMs(input.targetDate ?? null);
        const id = goalRepository.insert(tx, {
          userId: ctx.userId,
          name,
          targetMinor: input.targetMinor,
          targetDate,
          now: ctx.now(),
        });
        let contributionId: string | null = null;
        if (initial > 0 && input.accountId) {
          contributionId = addContribution(tx, id, input.accountId, initial, ctx.now());
          fx.refresh('accounts');
        }
        fx.refresh('goals');
        if (autoActivateWidget(tx, ctx, 'goals')) fx.refresh('settings');
        return { id, contributionId };
      });
    },

    /** Transferencia interna cuenta -> meta. NUNCA crea una Transaction. */
    contribute(input: ContributeInput): OperationResult<{ contributionId: string }> {
      return runOperation(ctx, (tx, fx) => {
        requireActiveGoal(tx, input.goalId);
        const contributionId = addContribution(
          tx,
          input.goalId,
          input.accountId,
          input.amountMinor,
          input.date ?? ctx.now(),
        );
        fx.refresh('goals', 'accounts');
        return { contributionId };
      });
    },

    update(id: string, input: UpdateGoalInput): OperationResult<{ adjusted: boolean }> {
      return runOperation(ctx, (tx, fx) => {
        requireActiveGoal(tx, id);
        const now = ctx.now();
        if (input.targetMinor !== undefined) assertPositiveMinor(input.targetMinor, 'El objetivo');
        const targetDate = input.targetDate !== undefined ? targetDateMs(input.targetDate) : undefined;
        goalRepository.update(tx, id, {
          name: input.name !== undefined ? cleanName(input.name, 'El nombre de la meta') : undefined,
          targetMinor: input.targetMinor,
          targetDate,
          now,
        });
        let adjusted = false;
        if (input.savedMinor !== undefined) {
          assertNonNegativeMinor(input.savedMinor, 'El ahorro');
          const current = goalRepository.savedOf(tx, id);
          if (input.savedMinor !== current) {
            adjustmentRepository.insert(tx, {
              userId: ctx.userId,
              target: { type: 'GOAL', id },
              previousMinor: current,
              newMinor: input.savedMinor,
              reason: 'MANUAL',
              now,
            });
            adjusted = true;
          }
        }
        fx.refresh('goals');
        return { adjusted };
      });
    },

    /**
     * Cierra la meta (ACTIVE -> SPENT, irreversible) con la foto del ahorro. No pide cuenta, no crea
     * transaccion y no mueve dinero; el monto suma a `gastoMetas` del mes del cierre (D1, D11).
     */
    close(id: string): OperationResult<{ spentAmountMinor: number }> {
      return runOperation(ctx, (tx, fx) => {
        const goal = requireActiveGoal(tx, id);
        const saved = goalRepository.savedOf(tx, id);
        if (saved < goal.targetMinor) throw new GoalNotReachedError(saved, goal.targetMinor);
        goalRepository.markSpent(tx, id, saved, ctx.now());
        fx.refresh('goals', 'statement');
        return { spentAmountMinor: saved };
      });
    },

    /**
     * Meta activa: borra meta, aportes y ajustes de la meta. El dinero de cada aporte vuelve a su cuenta
     * de origen (D4), salvo el de cuentas ARCHIVADAS: una cuenta archivada no cambia de saldo, asi que
     * ese dinero se redirige a `options.refundAccountId` (una cuenta ACTIVA; un unico destino para todas
     * las cuentas archivadas -- SUPUESTO). Redireccion, en la misma transaccion y sin tocar el esquema:
     *   - por cada cuenta archivada de origen, un ajuste ARCHIVE_CLOSE de -X (deja su disponible como
     *     estaba antes de borrar los aportes);
     *   - un ajuste MANUAL de +total sobre la cuenta destino (previous/new/delta correctos).
     * Ninguno es ingreso ni gasto. Si hay aportes de cuentas archivadas y no se indica un destino valido
     * (inexistente, archivado o de otro usuario) lanza `RefundAccountRequiredError` con los datos para
     * preguntar. Sin aportes archivados, `refundAccountId` se ignora (ni se valida).
     * Meta SPENT: se rechaza (reescribiria gasto historico).
     */
    remove(id: string, options: RemoveGoalOptions = {}): OperationResult<RemoveGoalResult> {
      return runOperation(ctx, (tx, fx) => {
        const goal = goalRepository.getById(tx, id);
        if (!goal) throw new NotFoundError('Meta', id);
        if (goal.status !== 'ACTIVE') throw new GoalNotActiveError(id, 'Una meta cerrada no se puede eliminar');
        const refunds = refundsOf(tx, id);
        const archived = refunds.filter((r) => r.accountArchived);
        const redirectedMinor = archived.reduce((sum, r) => sum + r.amountMinor, 0);

        let destinationId: string | null = null;
        if (archived.length > 0) {
          const requested = options.refundAccountId ?? null;
          const destination = requested !== null ? accountRepository.getById(tx, requested) : undefined;
          if (
            requested === null ||
            destination === undefined ||
            destination.archivedAt !== null ||
            destination.userId !== ctx.userId
          ) {
            throw new RefundAccountRequiredError(id, redirectedMinor, toSources(archived), requested);
          }
          destinationId = destination.id;
        }

        goalContributionRepository.deleteByGoal(tx, id);
        adjustmentRepository.deleteFor(tx, { type: 'GOAL', id });
        goalRepository.delete(tx, id);

        if (destinationId !== null) {
          const now = ctx.now();
          for (const source of archived) {
            // Tras borrar los aportes el disponible de la archivada subio en `amountMinor`: se cancela.
            const current = accountRepository.availableOf(tx, source.accountId);
            adjustmentRepository.insert(tx, {
              userId: ctx.userId,
              target: { type: 'ACCOUNT', id: source.accountId },
              previousMinor: current,
              newMinor: current - source.amountMinor,
              reason: 'ARCHIVE_CLOSE',
              now,
            });
          }
          const destCurrent = accountRepository.availableOf(tx, destinationId);
          adjustmentRepository.insert(tx, {
            userId: ctx.userId,
            target: { type: 'ACCOUNT', id: destinationId },
            previousMinor: destCurrent,
            newMinor: destCurrent + redirectedMinor,
            reason: 'MANUAL',
            now,
          });
        }
        fx.refresh('goals', 'accounts');
        return { refunds, redirectedMinor, refundAccountId: destinationId };
      });
    },

    // --- Consultas (solo lectura) -------------------------------------------

    /** Metas con el ahorro derivado y su ETA. `status` filtra (la lista de la app muestra solo ACTIVE). */
    list(status?: GoalStatus): GoalView[] {
      const saved = goalRepository.savedByGoal(ctx.db, ctx.userId);
      return goalRepository.list(ctx.db, ctx.userId, status).map((g) => viewOf(ctx.db, g, saved.get(g.id) ?? 0));
    },

    get(id: string): GoalView | undefined {
      const g = goalRepository.getById(ctx.db, id);
      if (!g) return undefined;
      return viewOf(ctx.db, g, g.status === 'SPENT' ? 0 : goalRepository.savedOf(ctx.db, id));
    },

    /** Aportes de la meta (del mas antiguo al mas reciente) con su cuenta de origen y fecha en epoch ms. */
    contributions(goalId: string): GoalContributionView[] {
      return goalContributionRepository.listByGoal(ctx.db, goalId).map((c) => {
        const account = accountRepository.getById(ctx.db, c.accountId);
        return {
          id: c.id,
          goalId: c.goalId,
          accountId: c.accountId,
          accountName: account?.name ?? '',
          accountArchived: account !== undefined && account.archivedAt !== null,
          amountMinor: c.amountMinor,
          date: c.date,
        };
      });
    },

    /**
     * "Se devolveran $a a Efectivo, $b a Ahorros": lo que devolveria `remove`. `accountArchived` marca
     * las cuentas que no pueden recibir el dinero; `requiresDestinationMinor` es lo que exige destino.
     */
    refundPreview(id: string): RefundPreview {
      const refunds = refundsOf(ctx.db, id);
      return {
        refunds,
        requiresDestinationMinor: refunds.filter((r) => r.accountArchived).reduce((sum, r) => sum + r.amountMinor, 0),
      };
    },
  };
}

export type GoalService = ReturnType<typeof createGoalService>;
