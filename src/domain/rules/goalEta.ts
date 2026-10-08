// =============================================================================
// GOAL ETA (cuando se alcanza una meta de ahorro)
// =============================================================================
//
// Regla PURA: no lee el reloj (el "ahora" es parametro) ni la BD. Solo considera APORTES (no ajustes
// manuales), que es lo que el servicio le pasa en `contributions`.
//
// Precedencia (decision del usuario, ver docs/ARCHITECTURE.md §10.2 punto 25): REACHED > BY_TARGET_DATE > BY_PACE > UNKNOWN.
//   - REACHED: ahorro >= objetivo.
//   - BY_TARGET_DATE: hay `targetDate`; gana sobre el ritmo. Devuelve esa fecha y el aporte mensual
//     necesario `ceil(falta / monthsLeft)`.
//       monthsLeft = el menor k >= 1 tal que (hoy + k meses) >= targetDate, con el dia ajustado al
//       ultimo del mes si hace falta (31 ene + 1 mes = 28 feb). Una fecha objetivo hoy cuenta como 1.
//       Si la fecha ya paso (`targetDate < hoy`): overdue = true, monthsLeft = 0 y el aporte
//       necesario es todo lo que falta.
//   - BY_PACE: sin `targetDate`. VENTANA: aportes con fecha en [inicio (00:00 local) del mes calendario
//     de hace 2 meses, now] -- es decir, el mes actual (parcial, hasta now) y los 2 anteriores
//     (completos) -- sumados y divididos SIEMPRE entre 3. Aportes posteriores a `now` no cuentan.
//     monthsLeft = ceil(falta / (suma / 3)) = ceil(3 * falta / suma); la fecha estimada es
//     hoy + monthsLeft meses (dia ajustado al ultimo del mes destino).
//     TOPE (F2b-ter): si monthsLeft no es un entero seguro, supera 1200 (100 anios; exactamente 1200 SE
//     INCLUYE) o la fecha no es una LocalDate valida de 4 digitos de anio, el resultado es UNKNOWN.
//   - UNKNOWN: sin `targetDate` y sin aportes en la ventana, o ritmo que supera el tope ("por calcular").
//     Tambien una `targetDate` que no es una fecha valida.
// =============================================================================

import {
  addMonthsToYearMonth,
  daysInMonth,
  formatLocalDate,
  isValidLocalDate,
  monthBounds,
  parseLocalDate,
  toLocalDate,
  type LocalDate,
} from '../dates';

export interface GoalEtaContribution {
  /** Instante del aporte (epoch ms). */
  date: number;
  /** Monto > 0 en unidades menores. */
  amountMinor: number;
}

export interface GoalEtaInput {
  /** Solo aportes de la meta (no ajustes). */
  contributions: readonly GoalEtaContribution[];
  /** Ahorro actual (aportes + ajustes). */
  savedMinor: number;
  targetMinor: number;
  /** Fecha objetivo local 'YYYY-MM-DD' o null. */
  targetDate: LocalDate | null;
  /** Instante actual (epoch ms), inyectado. */
  now: number;
}

export type GoalEta =
  | { kind: 'REACHED' }
  | {
      kind: 'BY_TARGET_DATE';
      date: LocalDate;
      /** true si la fecha objetivo ya paso. */
      overdue: boolean;
      /** Meses (>= 1; 0 si esta vencida) que hay hasta la fecha objetivo. */
      monthsLeft: number;
      /** Aporte mensual necesario para llegar: ceil(falta / monthsLeft); toda la falta si esta vencida. */
      requiredMonthlyMinor: number;
    }
  | {
      kind: 'BY_PACE';
      /** Fecha estimada: hoy + monthsLeft meses. */
      date: LocalDate;
      monthsLeft: number;
      /** Promedio mensual de la ventana, redondeado (suma / 3). */
      monthlyAverageMinor: number;
    }
  | { kind: 'UNKNOWN' };

/** Tope del ETA por ritmo: 100 anios. Decision del usuario (2026-10-07): exactamente 1200 meses SE INCLUYE (el tope es > 1200). */
export const MAX_PACE_MONTHS = 1200;

/** `date` + k meses de calendario; el dia se ajusta al ultimo del mes destino si hace falta. */
function addMonthsClamped(date: LocalDate, k: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const target = addMonthsToYearMonth(year, month, k);
  return formatLocalDate(target.year, target.month, Math.min(day, daysInMonth(target.year, target.month)));
}

export function goalEta(input: GoalEtaInput): GoalEta {
  const missing = input.targetMinor - input.savedMinor;
  if (missing <= 0) return { kind: 'REACHED' };

  const today = toLocalDate(input.now);

  if (input.targetDate !== null) {
    if (input.targetDate < today) {
      return {
        kind: 'BY_TARGET_DATE',
        date: input.targetDate,
        overdue: true,
        monthsLeft: 0,
        requiredMonthlyMinor: missing,
      };
    }
    // Una fecha objetivo que no es 'YYYY-MM-DD' valida (p. ej. anio de 5 digitos) no tiene ETA.
    if (!isValidLocalDate(input.targetDate)) return { kind: 'UNKNOWN' };
    // Sin bucle (cota O(1)): k0 = meses de calendario entre hoy y el mes de la fecha objetivo; el menor
    // k >= 1 con (hoy + k meses) >= targetDate es k0 si (hoy + k0 meses, dia ajustado) ya la alcanza,
    // si no k0 + 1 (el mes siguiente siempre la supera).
    const t = parseLocalDate(input.targetDate);
    const now = parseLocalDate(today);
    const k0 = (t.year - now.year) * 12 + (t.month - now.month);
    const monthsLeft = k0 >= 1 && addMonthsClamped(today, k0) >= input.targetDate ? k0 : k0 + 1;
    return {
      kind: 'BY_TARGET_DATE',
      date: input.targetDate,
      overdue: false,
      monthsLeft,
      requiredMonthlyMinor: Math.ceil(missing / monthsLeft),
    };
  }

  const { year, month } = parseLocalDate(today);
  const first = addMonthsToYearMonth(year, month, -2);
  const windowStart = monthBounds(first.year, first.month).start;
  let total = 0;
  for (const c of input.contributions) {
    if (c.date >= windowStart && c.date <= input.now) total += c.amountMinor;
  }
  if (total <= 0) return { kind: 'UNKNOWN' };

  const monthsLeft = Math.ceil((3 * missing) / total);
  // Tope: mas de 100 anios (o un valor que no es entero seguro / no da una fecha de 4 digitos) es "por calcular".
  if (!Number.isSafeInteger(monthsLeft) || monthsLeft > MAX_PACE_MONTHS) return { kind: 'UNKNOWN' };
  const date = addMonthsClamped(today, monthsLeft);
  if (!isValidLocalDate(date)) return { kind: 'UNKNOWN' };
  return {
    kind: 'BY_PACE',
    date,
    monthsLeft,
    monthlyAverageMinor: Math.round(total / 3),
  };
}
