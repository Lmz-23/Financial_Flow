import type { MonthStatement } from '../domain/rules/statement';
import { useDomainQuery } from './useDomainQuery';

/** Desglose del mes calendario en curso (hora local): ingresos, gastos, neto e Indice. */
export function useMonthStatement(): MonthStatement {
  return useDomainQuery(['statement'], (domain) => domain.reports.monthStatementOf());
}
