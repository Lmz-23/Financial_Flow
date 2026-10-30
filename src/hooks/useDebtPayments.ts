import type { TransactionRow } from '../database/repositories/transactionRepository';
import { useDomainQuery } from './useDomainQuery';

/** Pagos registrados de una deuda, del más reciente al más antiguo. */
export function useDebtPayments(id: string): TransactionRow[] {
  return useDomainQuery(['debts', 'transactions'], (domain) => domain.debts.payments(id), id);
}
