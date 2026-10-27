import type { DebtView } from '../domain/services/DebtService';
import { useDomainQuery } from './useDomainQuery';

/** Una deuda (activa o archivada) con saldo, tasa y proyeccion derivados, o undefined si no existe. */
export function useDebtDetail(id: string): DebtView | undefined {
  return useDomainQuery(['debts', 'transactions'], (domain) => domain.debts.get(id), id);
}
