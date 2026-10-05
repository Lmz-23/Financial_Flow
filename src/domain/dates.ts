// =============================================================================
// DATES (fechas locales 'YYYY-MM-DD')
// =============================================================================
//
// Una fecha de calendario es un texto 'YYYY-MM-DD' en HORA LOCAL del
// dispositivo; nunca se deriva de UTC (toISOString). La aritmética de calendario
// se hace con Date.UTC solo como calculadora (sin zona), y las conversiones a
// epoch ms usan el constructor local. Nada lee el reloj: el "ahora" es parámetro.
// =============================================================================

/** Fecha de calendario local, formato 'YYYY-MM-DD'. */
export type LocalDate = string;

export interface DateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Cantidad de días del mes (month 1-12). */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Valida formato y que el día exista en el calendario. */
export function isValidLocalDate(value: string): value is LocalDate {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Descompone una fecha local. Lanza si es inválida. */
export function parseLocalDate(value: LocalDate): DateParts {
  if (!isValidLocalDate(value)) {
    throw new RangeError(`Fecha local inválida: ${value}`);
  }
  const m = LOCAL_DATE_RE.exec(value) as RegExpExecArray;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Fecha local (calendario del dispositivo) correspondiente a un instante. */
export function toLocalDate(epochMs: number): LocalDate {
  const d = new Date(epochMs);
  return formatLocalDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Instante local (epoch ms) de una fecha local a una hora dada.
 * Usa el constructor local de Date, sin pasar por UTC.
 */
export function localDateToEpochMs(date: LocalDate, hour = 0, minute = 0): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

/** Último día del mes de la fecha dada (como fecha local). */
export function lastDayOfMonth(date: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(date);
  return formatLocalDate(year, month, daysInMonth(year, month));
}

/** Suma (o resta) días de calendario. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const t = Date.UTC(year, month - 1, day) + days * MS_PER_DAY;
  const d = new Date(t);
  return formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Día de la semana: 0 = domingo ... 6 = sábado. */
export function dayOfWeek(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Negativo si a < b, 0 si iguales, positivo si a > b. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Días de calendario entre a y b (b - a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / MS_PER_DAY,
  );
}

/** Suma meses a (year, month) y normaliza. month 1-12. */
export function addMonthsToYearMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}

/**
 * Límites del mes calendario local: [start, end) en epoch ms,
 * donde end es el inicio del mes siguiente. month 1-12.
 */
export function monthBounds(year: number, month: number): { start: number; end: number } {
  const next = addMonthsToYearMonth(year, month, 1);
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0).getTime(),
    end: new Date(next.year, next.month - 1, 1, 0, 0, 0, 0).getTime(),
  };
}

/** Límites del mes calendario local que contiene el instante dado. */
export function monthBoundsOf(epochMs: number): { start: number; end: number } {
  const d = new Date(epochMs);
  return monthBounds(d.getFullYear(), d.getMonth() + 1);
}
