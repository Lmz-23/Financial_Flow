import { describe, expect, it } from 'vitest';

import { currentWeekIn, isOverdueOccurrence, overdueDates } from '../../../src/lib/recurringDesktop';

describe('currentWeekIn', () => {
  it('ubica el día en su semana', () => {
    expect(currentWeekIn('2026-10-01', 2026, 10)).toBe(1);
    expect(currentWeekIn('2026-10-14', 2026, 10)).toBe(2);
    expect(currentWeekIn('2026-10-21', 2026, 10)).toBe(3);
    expect(currentWeekIn('2026-10-31', 2026, 10)).toBe(4);
  });
  it('es null en otro mes o año', () => {
    expect(currentWeekIn('2026-10-30', 2026, 11)).toBeNull();
    expect(currentWeekIn('2026-10-30', 2025, 10)).toBeNull();
  });
});

describe('overdueDates', () => {
  const upcoming = [
    { recurringId: 'a', nextDueDate: '2026-10-05', status: 'OVERDUE' as const },
    { recurringId: 'b', nextDueDate: '2026-10-20', status: 'PENDING' as const },
    { recurringId: 'c', nextDueDate: '2026-10-02', status: 'PAID' as const },
  ];
  it('solo incluye los vencidos', () => {
    expect([...overdueDates(upcoming).keys()]).toEqual(['a']);
  });
  it('marca solo la ocurrencia vencida', () => {
    const map = overdueDates(upcoming);
    expect(isOverdueOccurrence(map, 'a', '2026-10-05')).toBe(true);
    expect(isOverdueOccurrence(map, 'a', '2026-10-12')).toBe(false);
    expect(isOverdueOccurrence(map, 'b', '2026-10-20')).toBe(false);
  });
});
