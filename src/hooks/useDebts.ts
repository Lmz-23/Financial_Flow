import type { DebtView } from '../domain/services/DebtService';
import { useDomainQuery } from './useDomainQuery';

export interface DebtsSummary {
  debts: DebtView[];
  /** Σ saldo de las deudas no archivadas, en unidades menores. */
  totalMinor: number;
}

export function useDebts(): DebtsSummary {
  return useDomainQuery(['debts'], (domain) => {
    const debts = domain.debts.list();
    return { debts, totalMinor: debts.reduce((sum, d) => sum + d.balanceMinor, 0) };
  });
}
