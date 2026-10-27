import type { RecurringRow } from '../database/repositories/recurringRepository';
import { useDomainQuery } from './useDomainQuery';

/** Recurrentes STANDARD (pagos e ingresos; las cuotas de deuda se gestionan en Deudas). */
export function useRecurringList(): RecurringRow[] {
  return useDomainQuery(['recurring'], (domain) => domain.recurring.list());
}

/** Un recurrente STANDARD por id, o undefined si no existe o es la cuota de una deuda. */
export function useRecurringItem(id: string): RecurringRow | undefined {
  return useDomainQuery(['recurring'], (domain) => domain.recurring.list().find((r) => r.id === id), id);
}
