import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareLocalDates,
  daysInMonth,
  dayOfWeek,
  diffDays,
  isLeapYear,
  isValidLocalDate,
  lastDayOfMonth,
  localDateToEpochMs,
  monthBounds,
  monthBoundsOf,
  parseLocalDate,
  toLocalDate,
} from '../../../src/domain/dates';

describe('dates: calendario', () => {
  it('detecta años bisiestos', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('días por mes', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2025, 4)).toBe(30);
    expect(daysInMonth(2025, 12)).toBe(31);
  });

  it('valida fechas', () => {
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2025-02-29')).toBe(false);
    expect(isValidLocalDate('2025-13-01')).toBe(false);
    expect(isValidLocalDate('2025-1-1')).toBe(false);
    expect(() => parseLocalDate('2025-04-31')).toThrow(RangeError);
    expect(parseLocalDate('2025-04-30')).toEqual({ year: 2025, month: 4, day: 30 });
  });

  it('último día del mes', () => {
    expect(lastDayOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(lastDayOfMonth('2025-02-10')).toBe('2025-02-28');
    expect(lastDayOfMonth('2025-11-01')).toBe('2025-11-30');
    expect(lastDayOfMonth('2025-12-31')).toBe('2025-12-31');
  });

  it('suma de días a través de mes y año', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2025-06-15', 0)).toBe('2025-06-15');
    expect(addDays('2025-01-01', 366)).toBe('2026-01-02');
  });

  it('comparación y diferencia', () => {
    expect(compareLocalDates('2025-01-31', '2025-02-01')).toBe(-1);
    expect(compareLocalDates('2025-02-01', '2025-02-01')).toBe(0);
    expect(compareLocalDates('2026-01-01', '2025-12-31')).toBe(1);
    expect(diffDays('2024-02-28', '2024-03-01')).toBe(2);
    expect(diffDays('2025-03-01', '2025-02-01')).toBe(-28);
  });

  it('día de la semana', () => {
    expect(dayOfWeek('2026-10-04')).toBe(0); // domingo
    expect(dayOfWeek('2026-10-03')).toBe(6);
  });
});

describe('dates: hora local (TZ=America/Bogota)', () => {
  it('la zona de pruebas es Bogotá', () => {
    expect(new Date(2025, 0, 1).getTimezoneOffset()).toBe(300);
  });

  it('toLocalDate usa el calendario local, no UTC', () => {
    // 2025-03-31 22:30 en Bogotá = 2025-04-01 03:30 UTC
    const ms = new Date(2025, 2, 31, 22, 30).getTime();
    expect(new Date(ms).toISOString().startsWith('2025-04-01')).toBe(true);
    expect(toLocalDate(ms)).toBe('2025-03-31');
  });

  it('localDateToEpochMs ida y vuelta', () => {
    const ms = localDateToEpochMs('2025-03-31', 23, 59);
    expect(toLocalDate(ms)).toBe('2025-03-31');
    expect(new Date(ms).getHours()).toBe(23);
    expect(localDateToEpochMs('2025-03-31')).toBe(new Date(2025, 2, 31).getTime());
  });

  it('límites de mes: [inicio, inicio del mes siguiente)', () => {
    const { start, end } = monthBounds(2025, 3);
    expect(start).toBe(new Date(2025, 2, 1).getTime());
    expect(end).toBe(new Date(2025, 3, 1).getTime());
    // Último ms de marzo (hora local) está dentro; el inicio de abril, fuera.
    const lastMs = new Date(2025, 2, 31, 23, 59, 59, 999).getTime();
    expect(lastMs >= start && lastMs < end).toBe(true);
    const aprilFirst = new Date(2025, 3, 1).getTime();
    expect(aprilFirst >= start && aprilFirst < end).toBe(false);
  });

  it('límites de diciembre cruzan de año', () => {
    const { start, end } = monthBounds(2025, 12);
    expect(end).toBe(new Date(2026, 0, 1).getTime());
    expect(start).toBe(new Date(2025, 11, 1).getTime());
  });

  it('febrero bisiesto vs no bisiesto', () => {
    const days = (y: number) => {
      const b = monthBounds(y, 2);
      return Math.round((b.end - b.start) / 86_400_000);
    };
    expect(days(2024)).toBe(29);
    expect(days(2025)).toBe(28);
  });

  it('monthBoundsOf: un instante a las 23:30 locales del último día pertenece a su mes', () => {
    const ms = new Date(2025, 0, 31, 23, 30).getTime(); // ya es 1 feb en UTC
    const b = monthBoundsOf(ms);
    expect(b.start).toBe(new Date(2025, 0, 1).getTime());
    expect(b.end).toBe(new Date(2025, 1, 1).getTime());
  });
});
