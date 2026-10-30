// Apoyo de la vista de escritorio de Recurrentes (cuatro columnas por semana), puro para probarlo.
import { parseLocalDate, type LocalDate } from '../domain/dates';
import { weekOfMonth, type WeekOfMonth } from '../domain/rules/periods';
import type { UpcomingItem } from '../domain/services/RecurringService';

/** Semana (1-4) que contiene `today` si cae en el mes mostrado; null si se mira otro mes. */
export function currentWeekIn(today: LocalDate, year: number, month: number): WeekOfMonth | null {
  const t = parseLocalDate(today);
  return t.year === year && t.month === month ? weekOfMonth(t.day) : null;
}

/** Fechas vencidas por recurrente: `recurringId` -> `nextDueDate` mientras su estado sea OVERDUE. */
export function overdueDates(
  upcoming: readonly Pick<UpcomingItem, 'recurringId' | 'nextDueDate' | 'status'>[],
): Map<string, LocalDate> {
  const map = new Map<string, LocalDate>();
  for (const u of upcoming) if (u.status === 'OVERDUE') map.set(u.recurringId, u.nextDueDate);
  return map;
}

/** true si la ocurrencia `date` del recurrente es justo la que está vencida. */
export function isOverdueOccurrence(
  overdue: ReadonlyMap<string, LocalDate>,
  recurringId: string,
  date: LocalDate,
): boolean {
  return overdue.get(recurringId) === date;
}
