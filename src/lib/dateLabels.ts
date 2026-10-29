// Etiquetas de fecha para la interfaz (es-CO). Puras y SIN `Intl` (puede estar incompleto en
// Hermes, igual que `formatCOP`). La fecha de calendario es local (`LocalDate`, 'YYYY-MM-DD').
import { diffDays, parseLocalDate, toLocalDate, dayOfWeek, type LocalDate } from '../domain/dates';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

/** 10 -> 'oct'. */
export function monthShortLabel(month: number): string {
  return MONTHS[month - 1];
}

/** (2026, 10) -> 'Octubre 2026'. */
export function monthYearLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** '2026-10-15' -> '15 oct' (fmtDate del diseño, Dashboard.dc.html ~938). */
export function shortDateLabel(date: LocalDate): string {
  const { month, day } = parseLocalDate(date);
  return `${day} ${MONTHS[month - 1]}`;
}

/** '2026-10-15' -> '15 oct 2026' (campo de fecha). */
export function fullDateLabel(date: LocalDate): string {
  const { year } = parseLocalDate(date);
  return `${shortDateLabel(date)} ${year}`;
}

/**
 * Fecha de un movimiento: 'Hoy', 'Ayer', dia de la semana ('Lun') hasta 6 dias atras y '15 oct'
 * para lo mas antiguo o futuro. El diseno solo muestra 'Hoy', 'Ayer' y 'Lun' (datos de ejemplo);
 * el corte de 6 dias para el dia de la semana es una inferencia de presentacion.
 */
export function relativeDateLabel(epochMs: number, nowMs: number): string {
  const date = toLocalDate(epochMs);
  const ago = diffDays(date, toLocalDate(nowMs));
  if (ago === 0) return 'Hoy';
  if (ago === 1) return 'Ayer';
  if (ago >= 2 && ago <= 6) return WEEKDAYS[dayOfWeek(date)];
  return shortDateLabel(date);
}
