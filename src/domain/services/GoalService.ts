import { accountRepository } from '../../database/repositories/accountRepository';
import { adjustmentRepository } from '../../database/repositories/adjustmentRepository';
import { goalContributionRepository } from '../../database/repositories/goalContributionRepository';
import { goalRepository, type GoalRow, type GoalStatus } from '../../database/repositories/goalRepository';
import type { DbOrTx } from '../../database/types';
import { GoalNotActiveError, GoalNotReachedError, InsufficientFundsError, NotFoundError, ValidationError } from './errors';
import {
  assertEpochMs,
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
}

export interface GoalView extends GoalRow {
  /** Ahorro derivado (aportes + ajustes). En una meta SPENT es la foto `spentAmountMinor`. */
  savedMinor: number;
}

export interface GoalRefund {
  accountId: string;
  accountName: string;
  amountMinor: number;
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
    return goalContributionRepository.totalsByAccount(db, goalId).map((r) => ({
      accountId: r.accountId,
      accountName: accountRepository.getById(db, r.accountId)?.name ?? '',
      amountMinor: r.amountMinor,
    }));
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
        const id = goalRepository.insert(tx, {
          userId: ctx.userId,
          name,
          targetMinor: input.targetMinor,
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
        goalRepository.update(tx, id, {
          name: input.name !== undefined ? cleanName(input.name, 'El nombre de la meta') : undefined,
          targetMinor: input.targetMinor,
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
     * Meta activa: borra meta, aportes y ajustes; el dinero vuelve solo a cada cuenta de origen (D4).
     * Meta SPENT: se rechaza (reescribiria gasto historico).
     */
    remove(id: string): OperationResult<{ refunds: GoalRefund[] }> {
      return runOperation(ctx, (tx, fx) => {
        const goal = goalRepository.getById(tx, id);
        if (!goal) throw new NotFoundError('Meta', id);
        if (goal.status !== 'ACTIVE') throw new GoalNotActiveError(id, 'Una meta cerrada no se puede eliminar');
        const refunds = refundsOf(tx, id);
        goalContributionRepository.deleteByGoal(tx, id);
        adjustmentRepository.deleteFor(tx, { type: 'GOAL', id });
        goalRepository.delete(tx, id);
        fx.refresh('goals', 'accounts');
        return { refunds };
      });
    },

    // --- Consultas (solo lectura) -------------------------------------------

    /** Metas con el ahorro derivado. `status` filtra (la lista de la app muestra solo ACTIVE). */
    list(status?: GoalStatus): GoalView[] {
      const saved = goalRepository.savedByGoal(ctx.db, ctx.userId);
      return goalRepository.list(ctx.db, ctx.userId, status).map((g) => ({
        ...g,
        savedMinor: g.status === 'SPENT' ? (g.spentAmountMinor ?? 0) : (saved.get(g.id) ?? 0),
      }));
    },

    get(id: string): GoalView | undefined {
      const g = goalRepository.getById(ctx.db, id);
      if (!g) return undefined;
      return {
        ...g,
        savedMinor: g.status === 'SPENT' ? (g.spentAmountMinor ?? 0) : goalRepository.savedOf(ctx.db, id),
      };
    },

    /** "Se devolveran $a a Efectivo, $b a Ahorros": lo que devolveria `remove` hoy. */
    refundPreview(id: string): GoalRefund[] {
      return refundsOf(ctx.db, id);
    },
  };
}

export type GoalService = ReturnType<typeof createGoalService>;
