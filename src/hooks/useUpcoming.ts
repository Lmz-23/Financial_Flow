import type { UpcomingItem } from '../domain/services/RecurringService';
import { useDomainQuery } from './useDomainQuery';

/** Proximos pagos e ingresos recurrentes con fecha (estado PENDING, OVERDUE o PAID). */
export function useUpcoming(): UpcomingItem[] {
  // El estado depende de las transacciones confirmadas y del saldo de las deudas con cuota.
  return useDomainQuery(['recurring', 'transactions', 'debts'], (domain) => domain.recurring.upcoming());
}
