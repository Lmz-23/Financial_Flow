// Lista de recurrentes por semana del mes (pedido de Leonardo, 2026-10-28): cada recurrente aparece
// en la semana de cada una de sus ocurrencias del mes (un semanal sale en todas).
import { parseLocalDate, type LocalDate } from '../domain/dates';
import type { UpcomingStatus } from '../domain/services/RecurringService';
import { monthWeeks, weekOfMonth, type WeekOfMonth } from '../domain/rules/periods';
import { occurrencesInMonth, type Frequency } from '../domain/rules/recurrence';
import { monthShortLabel } from './dateLabels';

interface WeekItem {
  anchorDate: string | null;
  frequency: Frequency;
  name: string | null;
}

export interface RecurringWeek<T> {
  week: WeekOfMonth;
  /** 'Semana 1 · 1–7 oct'. */
  title: string;
  occurrences: { item: T; date: LocalDate }[];
}

export function recurringByWeek<T extends WeekItem>(
  items: readonly T[],
  year: number,
  month: number,
): { weeks: RecurringWeek<T>[]; dateless: T[] } {
  const weeks: RecurringWeek<T>[] = monthWeeks(year, month).map(({ week, fromDay, toDay }) => ({
    week,
    title: `Semana ${week} · ${fromDay}–${toDay} ${monthShortLabel(month)}`,
    occurrences: [],
  }));
  const dateless: T[] = [];
  for (const item of items) {
    if (item.anchorDate === null) {
      dateless.push(item);
      continue;
    }
    for (const date of occurrencesInMonth(item.anchorDate, item.frequency, year, month)) {
      weeks[weekOfMonth(parseLocalDate(date).day) - 1].occurrences.push({ item, date });
    }
  }
  for (const w of weeks) {
    w.occurrences.sort((a, b) => (a.date === b.date ? (a.item.name ?? '').localeCompare(b.item.name ?? '') : a.date < b.date ? -1 : 1));
  }
  return { weeks, dateless };
}

/**
 * "Próximos pagos" del dashboard: solo la semana del mes de hoy (misma division de 4 semanas) mas los
 * vencidos, ordenados por fecha. Sin titulos de semana: cada fila ya muestra su fecha.
 */
export function upcomingThisWeek<T extends { nextDueDate: LocalDate; status: UpcomingStatus; name: string }>(
  items: readonly T[],
  today: LocalDate,
): T[] {
  const week = weekOfMonth(parseLocalDate(today).day);
  const month = today.slice(0, 7);
  return items
    .filter(
      (i) =>
        i.status === 'OVERDUE' ||
        (i.status === 'PENDING' && i.nextDueDate.startsWith(month) && weekOfMonth(parseLocalDate(i.nextDueDate).day) === week),
    )
    .sort((a, b) => (a.nextDueDate === b.nextDueDate ? a.name.localeCompare(b.name) : a.nextDueDate < b.nextDueDate ? -1 : 1));
}
