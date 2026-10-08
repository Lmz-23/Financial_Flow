import type { TransactionView } from '../database/repositories/transactionRepository';
import { useDomainQuery } from './useDomainQuery';

export interface RecentTransactions {
  /** Del mas reciente al mas antiguo. */
  items: TransactionView[];
  /** Instante de la consulta (epoch ms): referencia para "Hoy" y "Ayer"; se renueva al invalidar. */
  now: number;
}

export function useRecentTransactions(limit = 4): RecentTransactions {
  return useDomainQuery(
    ['transactions'],
    (domain) => ({ items: domain.transactions.list({ limit }), now: Date.now() }),
    String(limit),
  );
}
