import type { LocalDate } from '../domain/dates';
import type { Period } from '../domain/rules/periods';
import type { PeriodReport } from '../domain/services/ReportService';
import { useDomainQuery } from './useDomainQuery';

/** Detalle del flujo del periodo elegido (mes, trimestre, semestre o año). */
export function usePeriodReport(period: Period): PeriodReport {
  return useDomainQuery(
    ['statement', 'transactions'],
    (domain) => domain.reports.periodReport(period),
    `${period.kind}:${period.year}:${period.index}`,
  );
}

/** Fecha del primer movimiento del usuario (hasta ahí se puede retroceder); null si no hay datos. */
export function useFirstActivityDate(): LocalDate | null {
  return useDomainQuery(['statement', 'transactions'], (domain) => domain.reports.firstActivityDate());
}
