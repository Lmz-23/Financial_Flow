// =============================================================================
// GOAL ETA (cuando se alcanza una meta de ahorro)
// =============================================================================
//
// Regla PURA: no lee el reloj (el "ahora" es parametro) ni la BD. Solo considera APORTES (no ajustes
// manuales), que es lo que el servicio le pasa en `contributions`.
//
// Precedencia (SUPUESTO de la pasada F2b-bis, a validar): REACHED > BY_TARGET_DATE > BY_PACE > UNKNOWN.
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
//   - UNKNOWN: sin `targetDate` y sin aportes en la ventana ("por calcular").
// =============================================================================

import {
  addMonthsToYearMonth,
  daysInMonth,
  formatLocalDate,
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
    let monthsLeft = 1;
    while (addMonthsClamped(today, monthsLeft) < input.targetDate) monthsLeft++;
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
  return {
    kind: 'BY_PACE',
    date: addMonthsClamped(today, monthsLeft),
    monthsLeft,
    monthlyAverageMinor: Math.round(total / 3),
  };
}
