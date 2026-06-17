// =============================================================================
// DATE UTILITIES
// =============================================================================

export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUAL';

/**
 * Calculates the next occurrence date for a recurring item.
 *
 * @param frequency - WEEKLY, BIWEEKLY, MONTHLY, or ANNUAL
 * @param dayOfMonth - Day of month (1-31) for MONTHLY/ANNUAL
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday) for WEEKLY
 * @param month - Month (1-12) for ANNUAL
 * @param fromDate - Reference date to calculate from
 * @returns The next occurrence date
 */
export function getNextOccurrence(
  frequency: Frequency,
  dayOfMonth: number | null,
  dayOfWeek: number | null,
  month: number | null,
  fromDate: Date = new Date()
): Date {
  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);

  switch (frequency) {
    case 'WEEKLY': {
      if (dayOfWeek === null) dayOfWeek = 1; // Default to Monday
      const currentDayOfWeek = today.getDay();
      let daysToAdd = dayOfWeek - currentDayOfWeek;
      if (daysToAdd <= 0) daysToAdd += 7; // Next week if today is same or past
      const next = new Date(today);
      next.setDate(today.getDate() + daysToAdd);
      return next;
    }

    case 'BIWEEKLY': {
      if (dayOfWeek === null) dayOfWeek = 1;
      const currentDayOfWeek = today.getDay();
      let daysToAdd = dayOfWeek - currentDayOfWeek;
      if (daysToAdd <= 0) daysToAdd += 7;
      const next = new Date(today);
      next.setDate(today.getDate() + daysToAdd);
      // If we're past this occurrence, add another week for biweekly
      if (next <= today) {
        next.setDate(next.getDate() + 14);
      }
      return next;
    }

    case 'MONTHLY': {
      const targetDay = dayOfMonth ?? 1;
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      let nextMonth = currentMonth;
      let nextYear = currentYear;

      if (currentDay < targetDay) {
        // Same month, later day
        const next = new Date(currentYear, currentMonth, targetDay);
        return next;
      } else {
        // Move to next month
        nextMonth = currentMonth + 1;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear++;
        }
        // Handle months with fewer days (e.g., 31st -> Feb 28)
        const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const actualDay = Math.min(targetDay, lastDayOfNextMonth);
        return new Date(nextYear, nextMonth, actualDay);
      }
    }

    case 'ANNUAL': {
      const targetDay = dayOfMonth ?? 1;
      const targetMonth = (month ?? 1) - 1; // JS months are 0-indexed
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();
      const currentYear = today.getFullYear();

      let nextMonth = targetMonth;
      let nextYear = currentYear;

      if (targetMonth < currentMonth || (targetMonth === currentMonth && currentDay >= targetDay)) {
        // Next year
        nextYear++;
      }

      // Handle leap years for Feb 29
      const lastDayOfMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
      const actualDay = Math.min(targetDay, lastDayOfMonth);
      return new Date(nextYear, nextMonth, actualDay);
    }

    default:
      return today;
  }
}

/**
 * Checks if a due date is overdue (before today).
 */
export function isOverdue(dueDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Checks if a due date is today.
 */
export function isDueToday(dueDate: Date): boolean {
  const today = new Date();
  const due = new Date(dueDate);
  return (
    today.getFullYear() === due.getFullYear() &&
    today.getMonth() === due.getMonth() &&
    today.getDate() === due.getDate()
  );
}

/**
 * Checks if a due date is tomorrow.
 */
export function isDueTomorrow(dueDate: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const due = new Date(dueDate);
  return (
    tomorrow.getFullYear() === due.getFullYear() &&
    tomorrow.getMonth() === due.getMonth() &&
    tomorrow.getDate() === due.getDate()
  );
}

/**
 * Returns the number of days until a date (negative if past).
 */
export function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Formats a date as a relative string in Spanish.
 *
 * @example
 * formatRelative(new Date())              // "hoy"
 * formatRelative(tomorrow)                // "mañana"
 * formatRelative(today + 3 days)          // "en 3 días"
 * formatRelative(today - 1 day)           // "ayer"
 * formatRelative(today - 2 days)          // "hace 2 días"
 * formatRelative(today - 1 week)          // "hace 7 días"
 */
export function formatRelative(date: Date): string {
  const days = daysUntil(date);

  if (days === 0) {
    return 'hoy';
  }

  if (days === 1) {
    return 'mañana';
  }

  if (days === -1) {
    return 'ayer';
  }

  if (days > 1 && days <= 7) {
    return `en ${days} días`;
  }

  if (days < -1 && days >= -7) {
    return `hace ${Math.abs(days)} días`;
  }

  if (days > 7 && days <= 30) {
    const weeks = Math.floor(days / 7);
    return `en ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }

  if (days < -7 && days >= -30) {
    const weeks = Math.floor(Math.abs(days) / 7);
    return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }

  // For dates beyond 30 days, just return the formatted date
  return formatDate(date);
}

/**
 * Formats a date for display.
 *
 * @example
 * formatDate(new Date(2026, 5, 17))  // "17 jun 2026"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a date with time.
 *
 * @example
 * formatDateTime(new Date(2026, 5, 17, 14, 30))  // "17 jun 2026, 2:30 PM"
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Returns the start of the current month.
 */
export function getMonthStart(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Returns the end of the current month.
 */
export function getMonthEnd(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Returns an array of months between two dates.
 */
export function getMonthsBetween(startDate: Date, endDate: Date): Date[] {
  const months: Date[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (current <= endDate) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Gets the day of month safely, handling month overflow.
 */
export function getSafeDayOfMonth(year: number, month: number, day: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDayOfMonth);
}
