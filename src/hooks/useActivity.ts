import type { AccountTransferView } from '../database/repositories/accountTransferRepository';
import type { ActivityFilters, ActivityItem } from '../domain/services/ActivityService';
import { useDomainQuery } from './useDomainQuery';

export interface Activity {
  /** Transacciones y transferencias mezcladas, de la mas reciente a la mas antigua (`kind` las distingue). */
  items: ActivityItem[];
  /** Instante de la consulta (epoch ms): referencia para "Hoy" y "Ayer"; se renueva al invalidar. */
  now: number;
}

/** Actividad (transacciones + transferencias) filtrada por rango, cuenta y limite. */
export function useActivity(filters: ActivityFilters = {}): Activity {
  const { from, to, accountId, limit } = filters;
  return useDomainQuery(
    ['transactions'],
    (domain) => ({ items: domain.activity.list({ from, to, accountId, limit }), now: Date.now() }),
    JSON.stringify([from, to, accountId, limit]),
  );
}

/** Una transferencia o undefined si no existe (o ya se borro). */
export function useTransfer(id: string): AccountTransferView | undefined {
  return useDomainQuery(['transactions'], (domain) => domain.transfers.get(id), id);
}
