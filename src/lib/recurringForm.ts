// Textos y reglas puras de las pantallas de Recurrentes (F5b-3).
import { diffDays, type LocalDate } from '../domain/dates';
import { normalizeAnchor, type Frequency } from '../domain/rules/recurrence';
import { fullDateLabel, shortDateLabel } from './dateLabels';
import { FREQUENCY_OPTIONS } from './onboardingDraft';

/**
 * Vista previa EN VIVO del ajuste quincenal (arquitectura 3.4 / decision 21): si la frecuencia es
 * quincenal y la fecha elegida no es el 15 ni el ultimo dia del mes, devuelve el aviso con la fecha
 * valida mas cercana (empate: la posterior, lo decide `normalizeAnchor`). Sin ajuste: null.
 * Texto INFERIDO: ni el diseno ni los docs lo traen.
 */
export function biweeklyAdjustNotice(date: LocalDate | null, frequency: Frequency): string | null {
  if (date === null) return null;
  const { adjusted, date: valid } = normalizeAnchor(date, frequency);
  if (!adjusted) return null;
  return `Los pagos quincenales caen el 15 y el último día del mes. Tu primera fecha pasa al ${fullDateLabel(valid)}.`;
}

/** Subtitulo de la hoja «Ya pague». Hoy: texto del diseno (ConfirmacionPago.dc.html). Otros dias: INFERIDO. */
export function confirmSubtitle(occurrence: LocalDate, today: LocalDate): string {
  const tail = 'Confirma para mantener tu flujo del mes al día.';
  const ago = diffDays(occurrence, today);
  if (ago === 0) return `Vence hoy. ${tail}`;
  if (ago > 0) return `Venció el ${shortDateLabel(occurrence)}. ${tail}`;
  return `Vence el ${shortDateLabel(occurrence)}. ${tail}`;
}

/** Orden de la lista: primero los recurrentes sin fecha (piden atencion) y luego por proximo vencimiento. */
export function sortRecurring<T extends { nextDueDate: string | null; name: string | null }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.nextDueDate === b.nextDueDate) return (a.name ?? '').localeCompare(b.name ?? '');
    if (a.nextDueDate === null) return -1;
    if (b.nextDueDate === null) return 1;
    return a.nextDueDate < b.nextDueDate ? -1 : 1;
  });
}

export function frequencyLabel(frequency: Frequency): string {
  return FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency;
}
