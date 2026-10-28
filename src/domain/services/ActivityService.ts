// =============================================================================
// ACTIVIDAD: transacciones y transferencias mezcladas por fecha (solo lectura)
// =============================================================================
// Una sola lista para Movimientos, Recientes del panel y el detalle de cuenta. El discriminante `kind` separa
// una Transaction ('TRANSACTION') de una transferencia entre cuentas ('TRANSFER').
import type { AccountTransferView } from '../../database/repositories/accountTransferRepository';
import type { TransactionView } from '../../database/repositories/transactionRepository';
import { accountTransferRepository } from '../../database/repositories/accountTransferRepository';
import { transactionRepository } from '../../database/repositories/transactionRepository';
import type { DomainContext } from './shared';

// El payload va ANIDADO porque `TransactionView.kind` ('STANDARD' | 'DEBT_PAYMENT') chocaria con el discriminante.
interface ActivityBase {
  id: string;
  /** Epoch ms: la fecha del movimiento (la de la lista). */
  date: number;
  createdAt: number;
}

export interface ActivityTransaction extends ActivityBase {
  kind: 'TRANSACTION';
  transaction: TransactionView;
}

export interface ActivityTransfer extends ActivityBase {
  kind: 'TRANSFER';
  /** Con filtro de cuenta: 'OUT' si es el origen e 'IN' si es el destino; sin filtro, null. */
  direction: 'IN' | 'OUT' | null;
  transfer: AccountTransferView;
}

export type ActivityItem = ActivityTransaction | ActivityTransfer;

export interface ActivityFilters {
  /** Epoch ms, inclusive. */
  from?: number;
  /** Epoch ms, exclusivo. */
  to?: number;
  /** Transacciones de la cuenta y transferencias donde es origen o destino. */
  accountId?: string;
  limit?: number;
}

export function createActivityService(ctx: DomainContext) {
  return {
    /** De la mas reciente a la mas antigua (desempate: la creada despues primero). */
    list(filters: ActivityFilters = {}): ActivityItem[] {
      const { from, to, accountId, limit } = filters;
      const transactions: ActivityTransaction[] = transactionRepository
        .list(ctx.db, ctx.userId, { from, to, accountId, limit })
        .map((t) => ({ kind: 'TRANSACTION', id: t.id, date: t.date, createdAt: t.createdAt, transaction: t }));
      const transfers: ActivityTransfer[] = accountTransferRepository
        .list(ctx.db, ctx.userId, { from, to, accountId, limit })
        .map((t) => ({
          kind: 'TRANSFER',
          id: t.id,
          date: t.date,
          createdAt: t.createdAt,
          direction: accountId === undefined ? null : t.fromAccountId === accountId ? 'OUT' : 'IN',
          transfer: t,
        }));
      const merged: ActivityItem[] = [...transactions, ...transfers].sort(
        (a, b) => b.date - a.date || b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      );
      return limit === undefined ? merged : merged.slice(0, limit);
    },
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;
