import type { TransactionView } from '../database/repositories/transactionRepository';
import { monthBoundsOf, parseLocalDate, toLocalDate } from '../domain/dates';
import { lastMonths } from '../lib/flowDesktop';
import { useDomainQuery } from './useDomainQuery';

/** Ingresos marcados como pasivos del mes calendario en curso, del más reciente al más antiguo. */
export function usePassiveIncomesOfMonth(): TransactionView[] {
  return useDomainQuery(['transactions'], (domain) => {
    const { start, end } = monthBoundsOf(Date.now());
    return domain.transactions.list({ from: start, to: end, type: 'INCOME' }).filter((t) => t.isPassive);
  });
}

export interface CashflowTrendPoint {
  year: number;
  month: number;
  /** Porcentaje entero del Índice (0 si no hubo ingreso pasivo o no hay datos). */
  percent: number;
}

/** Índice de Flujo de Caja de los últimos `count` meses (el actual al final), con los servicios de reportes. */
export function useCashflowTrend(count = 6): CashflowTrendPoint[] {
  return useDomainQuery(
    ['statement', 'transactions'],
    (domain) => {
      const { year, month } = parseLocalDate(toLocalDate(Date.now()));
      return lastMonths(year, month, count).map((m) => {
        const index = domain.reports.monthStatement(m.year, m.month).index;
        return { ...m, percent: index.kind === 'RATIO' ? Math.round(index.ratio * 100) : 0 };
      });
    },
    String(count),
  );
}
