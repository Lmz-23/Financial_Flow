// =============================================================================
// RECURRENCE (ocurrencias de recurrentes)
// =============================================================================
//
// Las ocurrencias se calculan SIEMPRE desde la fecha ancla, nunca desde "ahora":
// - MONTHLY: conserva el día del ancla; si el mes es más corto, usa su último
//   día (31 ene -> 28/29 feb -> 31 mar). Cada mes se calcula desde el ancla, no
//   encadenado, así que no hay deriva.
// - WEEKLY: ancla + 7k días.
// - BIWEEKLY ("quincenal"): días 15 y último día del mes.
//   SUPUESTO: el ancla es siempre la primera ocurrencia aunque no sea 15 ni
//   fin de mes; las siguientes son los días 15 / último estrictamente posteriores.
// =============================================================================

import {
  addDays,
  addMonthsToYearMonth,
  compareLocalDates,
  daysInMonth,
  formatLocalDate,
  parseLocalDate,
  type LocalDate,
} from '../dates';

export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** Límite de seguridad al buscar la siguiente ocurrencia pendiente. */
const MAX_SCAN = 20_000;

/** Siguiente quincena (día 15 o último día) estrictamente posterior a `date`. */
function nextQuincena(date: LocalDate): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const last = daysInMonth(year, month);
  if (day < 15) return formatLocalDate(year, month, 15);
  if (day < last) return formatLocalDate(year, month, last);
  const next = addMonthsToYearMonth(year, month, 1);
  return formatLocalDate(next.year, next.month, 15);
}

/** Generador infinito y ascendente de ocurrencias, desde el ancla inclusive. */
export function* iterateOccurrences(anchor: LocalDate, frequency: Frequency): Generator<LocalDate> {
  const a = parseLocalDate(anchor);
  switch (frequency) {
    case 'WEEKLY': {
      for (let k = 0; ; k++) yield addDays(anchor, 7 * k);
    }
    case 'MONTHLY': {
      for (let k = 0; ; k++) {
        const { year, month } = addMonthsToYearMonth(a.year, a.month, k);
        yield formatLocalDate(year, month, Math.min(a.day, daysInMonth(year, month)));
      }
    }
    case 'BIWEEKLY': {
      let current = anchor;
      for (;;) {
        yield current;
        current = nextQuincena(current);
      }
    }
  }
}

/** Ocurrencias con from <= fecha < toExclusive, ascendentes. */
export function occurrencesInRange(
  anchor: LocalDate,
  frequency: Frequency,
  from: LocalDate,
  toExclusive: LocalDate,
): LocalDate[] {
  const out: LocalDate[] = [];
  for (const occ of iterateOccurrences(anchor, frequency)) {
    if (compareLocalDates(occ, toExclusive) >= 0) break;
    if (compareLocalDates(occ, from) >= 0) out.push(occ);
  }
  return out;
}

/** Ocurrencias dentro de un mes calendario (month 1-12). */
export function occurrencesInMonth(
  anchor: LocalDate,
  frequency: Frequency,
  year: number,
  month: number,
): LocalDate[] {
  const next = addMonthsToYearMonth(year, month, 1);
  return occurrencesInRange(
    anchor,
    frequency,
    formatLocalDate(year, month, 1),
    formatLocalDate(next.year, next.month, 1),
  );
}

/** Primera ocurrencia estrictamente posterior a `date` (siempre >= ancla). */
export function nextOccurrenceAfter(
  anchor: LocalDate,
  frequency: Frequency,
  date: LocalDate,
): LocalDate {
  for (const occ of iterateOccurrences(anchor, frequency)) {
    if (compareLocalDates(occ, date) > 0) return occ;
  }
  /* istanbul ignore next: el generador es infinito */
  throw new Error('unreachable');
}

export interface NextPendingInput {
  anchor: LocalDate;
  frequency: Frequency;
  /** Fechas de ocurrencia con transacción confirmada. */
  confirmed: Iterable<LocalDate>;
  /** Si se pasa, se ignoran ocurrencias anteriores a esta fecha. */
  minDate?: LocalDate;
}

/**
 * Siguiente ocurrencia pendiente: la primera, desde el ancla (o minDate), cuya
 * fecha no esté confirmada. null si no se encuentra dentro del límite de búsqueda.
 */
export function nextPendingOccurrence(input: NextPendingInput): LocalDate | null {
  const confirmed = new Set(input.confirmed);
  let scanned = 0;
  for (const occ of iterateOccurrences(input.anchor, input.frequency)) {
    if (++scanned > MAX_SCAN) return null;
    if (input.minDate !== undefined && compareLocalDates(occ, input.minDate) < 0) continue;
    if (!confirmed.has(occ)) return occ;
  }
  return null;
}
