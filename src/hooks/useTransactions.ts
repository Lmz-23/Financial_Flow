import type { CategoryRow, CategoryType } from '../database/repositories/categoryRepository';
import type { TransactionFilters, TransactionView } from '../database/repositories/transactionRepository';
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

/** Transacciones filtradas (rango, cuenta, tipo, limite), de la mas reciente a la mas antigua. */
export function useTransactions(filters: TransactionFilters = {}): RecentTransactions {
  const { from, to, accountId, type, limit } = filters;
  return useDomainQuery(
    ['transactions'],
    (domain) => ({ items: domain.transactions.list({ from, to, accountId, type, limit }), now: Date.now() }),
    JSON.stringify([from, to, accountId, type, limit]),
  );
}

/** Una transaccion o undefined si no existe (o ya se borro). */
export function useTransaction(id: string): TransactionView | undefined {
  return useDomainQuery(['transactions'], (domain) => domain.transactions.get(id), id);
}

/** Categorias activas de un tipo (base + del usuario) para el selector; incluye las creadas en linea. */
export function useCategoryOptions(type: CategoryType): CategoryRow[] {
  return useDomainQuery(['transactions'], (domain) => domain.transactions.categories(type), type);
}
