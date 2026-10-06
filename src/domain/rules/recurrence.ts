// =============================================================================
// RECURRENCE (ocurrencias de recurrentes)
// =============================================================================
//
// Las ocurrencias se calculan SIEMPRE desde la fecha ancla, nunca desde "ahora":
// - MONTHLY: conserva el día del ancla; si el mes es más corto, usa su último
//   día (31 ene -> 28/29 feb -> 31 mar). Cada mes se calcula desde el ancla, no
//   encadenado, así que no hay deriva.
// - WEEKLY: ancla + 7k días.
// - BIWEEKLY ("quincenal"): días 15 y último día del mes. Decisión del usuario:
//   la PRIMERA fecha de un quincenal nunca puede ser otra que 15 o último día;
//   si el usuario elige otra, se AJUSTA a la fecha válida más cercana
//   (`nearestBiweeklyDate`). Contrato entre capas:
//   - La pantalla "Agregar recurrente" debe llamar a `normalizeAnchor` en vivo
//     y mostrar la fecha ajustada mientras el usuario elige (nunca cambiarla en
//     silencio tras guardar).
//   - El servicio que cree el recurrente debe guardar el ancla YA normalizada.
//   - Por defensa, este módulo normaliza el ancla BIWEEKLY internamente, así que
//     datos sin normalizar nunca producen una primera ocurrencia inválida.
// =============================================================================

import {
  addDays,
  addMonthsToYearMonth,
  compareLocalDates,
  daysInMonth,
  diffDays,
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

/**
 * Fecha quincenal válida (día 15 o último día de mes) más cercana a `date`,
 * midiendo la distancia en días de calendario. Candidatas: último día del mes
 * anterior, 15 del mes, último día del mes y 15 del mes siguiente.
 * Idempotente: una fecha ya válida se devuelve igual.
 *
 * EMPATES (SUPUESTO, pendiente de validar por el usuario): gana la fecha
 * POSTERIOR, para no adelantar un pago. Solo existen dos empates, entre el 15 y
 * el último día: día 23 en meses de 31 días (8 y 8) y día 22 en febrero de 29
 * días (7 y 7). Meses de 30 y de 28 días no tienen empates.
 */
export function nearestBiweeklyDate(date: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(date);
  const prev = addMonthsToYearMonth(year, month, -1);
  const next = addMonthsToYearMonth(year, month, 1);
  // Orden ascendente: con `<=` el empate lo gana la candidata posterior.
  const candidates: LocalDate[] = [
    formatLocalDate(prev.year, prev.month, daysInMonth(prev.year, prev.month)),
    formatLocalDate(year, month, 15),
    formatLocalDate(year, month, daysInMonth(year, month)),
    formatLocalDate(next.year, next.month, 15),
  ];
  let best = candidates[0] as LocalDate;
  let bestDistance = Math.abs(diffDays(date, best));
  for (const candidate of candidates) {
    const distance = Math.abs(diffDays(date, candidate));
    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export interface NormalizedAnchor {
  /** Fecha efectiva a mostrar y guardar como ancla. */
  date: LocalDate;
  /** true solo si `date` difiere de `original`. */
  adjusted: boolean;
  /** Fecha elegida por el usuario, sin modificar. */
  original: LocalDate;
}

/**
 * Normaliza el ancla según la frecuencia. Pura: pensada para que la pantalla la
 * llame en cada cambio de fecha y muestre el ajuste en vivo.
 * BIWEEKLY -> `nearestBiweeklyDate`; MONTHLY y WEEKLY -> sin cambios.
 */
export function normalizeAnchor(anchor: LocalDate, frequency: Frequency): NormalizedAnchor {
  if (frequency !== 'BIWEEKLY') return { date: anchor, adjusted: false, original: anchor };
  const date = nearestBiweeklyDate(anchor);
  return { date, adjusted: date !== anchor, original: anchor };
}

/**
 * Generador infinito y ascendente de ocurrencias, desde el ancla inclusive.
 * En BIWEEKLY el ancla efectiva es la normalizada.
 */
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
      let current = nearestBiweeklyDate(anchor);
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
