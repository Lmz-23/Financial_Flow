// =============================================================================
// PERIODOS DEL REPORTE (detalle del flujo) Y SEMANAS DEL MES
// =============================================================================
//
// Decisiones de Leonardo (2026-10-28):
// - El detalle del flujo se ve por mes, trimestre (ene-mar, abr-jun, jul-sep, oct-dic), semestre
//   (ene-jun, jul-dic) o año, y se puede ir a periodos anteriores aunque no tengan datos.
// - Un mes siempre tiene 4 semanas, sea de 28, 30 o 31 días: 1-7, 8-14, 15-21 y 22-último día.
//   La cuarta semana absorbe los días 29-31. La usan el gráfico del mes y la lista de recurrentes.
// =============================================================================

import { addMonthsToYearMonth, daysInMonth, formatLocalDate, parseLocalDate, type LocalDate } from '../dates';

export type PeriodKind = 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR';

/** `index`: mes 1-12, trimestre 1-4, semestre 1-2; en YEAR siempre 1. */
export interface Period {
  kind: PeriodKind;
  year: number;
  index: number;
}

export type WeekOfMonth = 1 | 2 | 3 | 4;

/** Tramo de fechas [from, toExclusive) de un periodo o de una de sus barras. */
export interface DateRange {
  from: LocalDate;
  toExclusive: LocalDate;
}

const MONTHS_PER: Record<PeriodKind, number> = { MONTH: 1, QUARTER: 3, SEMESTER: 6, YEAR: 12 };

/** Semana (1-4) del día del mes: del 22 en adelante siempre es la 4. */
export function weekOfMonth(day: number): WeekOfMonth {
  return Math.min(4, Math.ceil(day / 7)) as WeekOfMonth;
}

/** Días de las 4 semanas del mes: [1-7], [8-14], [15-21], [22-último]. */
export function monthWeeks(year: number, month: number): { week: WeekOfMonth; fromDay: number; toDay: number }[] {
  const last = daysInMonth(year, month);
  return ([1, 2, 3, 4] as const).map((week) => ({
    week,
    fromDay: (week - 1) * 7 + 1,
    toDay: week === 4 ? last : week * 7,
  }));
}

/** Periodo de `kind` que contiene la fecha. */
export function periodOf(kind: PeriodKind, date: LocalDate): Period {
  const { year, month } = parseLocalDate(date);
  const index = kind === 'YEAR' ? 1 : Math.ceil(month / MONTHS_PER[kind]);
  return { kind, year, index };
}

/** Primer mes (1-12) del periodo. */
function firstMonth(period: Period): number {
  return (period.index - 1) * MONTHS_PER[period.kind] + 1;
}

/** Meses del periodo, en orden. */
export function periodMonths(period: Period): { year: number; month: number }[] {
  const first = firstMonth(period);
  return Array.from({ length: MONTHS_PER[period.kind] }, (_, i) => ({ year: period.year, month: first + i }));
}

/** Periodo `delta` pasos antes (negativo) o después (positivo), del mismo tipo. */
export function shiftPeriod(period: Period, delta: number): Period {
  const { year, month } = addMonthsToYearMonth(period.year, firstMonth(period), delta * MONTHS_PER[period.kind]);
  return periodOf(period.kind, formatLocalDate(year, month, 1));
}

/** -1, 0 o 1 según el orden cronológico de dos periodos del mismo tipo. */
export function comparePeriods(a: Period, b: Period): number {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  return a.index === b.index ? 0 : a.index < b.index ? -1 : 1;
}

function monthRange(year: number, month: number): DateRange {
  const next = addMonthsToYearMonth(year, month, 1);
  return { from: formatLocalDate(year, month, 1), toExclusive: formatLocalDate(next.year, next.month, 1) };
}

/** Tramo completo del periodo. */
export function periodRange(period: Period): DateRange {
  const months = periodMonths(period);
  const last = months[months.length - 1];
  return { from: monthRange(months[0].year, months[0].month).from, toExclusive: monthRange(last.year, last.month).toExclusive };
}

/** Barras del gráfico: las 4 semanas en un mes; los meses en trimestre, semestre y año. */
export function periodBuckets(period: Period): DateRange[] {
  if (period.kind !== 'MONTH') return periodMonths(period).map(({ year, month }) => monthRange(year, month));
  const { year, index: month } = period;
  const end = monthRange(year, month).toExclusive;
  return monthWeeks(year, month).map(({ week, fromDay }) => ({
    from: formatLocalDate(year, month, fromDay),
    toExclusive: week === 4 ? end : formatLocalDate(year, month, fromDay + 7),
  }));
}
