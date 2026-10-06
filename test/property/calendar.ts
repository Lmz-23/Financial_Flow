// Calendario y series de recurrencia PROPIOS del modelo (no importan nada de src/domain).
// Algoritmo civil de Hinnant para convertir entre fecha y numero de dia; la zona local es
// America/Bogota (UTC-5 constante), la que fija vitest.config.ts.

const fl = Math.floor;

export const H = 3_600_000;
export const DAY = 86_400_000;
/** America/Bogota = UTC-5 sin horario de verano. */
const BOGOTA_OFFSET = 5 * H;

function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = fl(y / 400);
  const yoe = y - era * 400;
  const doy = fl((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + fl(yoe / 4) - fl(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(days: number): [number, number, number] {
  const z = days + 719468;
  const era = fl(z / 146097);
  const doe = z - era * 146097;
  const yoe = fl((doe - fl(doe / 1460) + fl(doe / 36524) - fl(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + fl(yoe / 4) - fl(yoe / 100));
  const mp = fl((5 * doy + 2) / 153);
  const d = doy - fl((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [y + (m <= 2 ? 1 : 0), m, d];
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');
export const fmt = (y: number, m: number, d: number): string => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
const isLeap = (y: number): boolean => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
export const dim = (y: number, m: number): number =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] as number;
export const parts = (s: string): [number, number, number] => [
  Number(s.slice(0, 4)),
  Number(s.slice(5, 7)),
  Number(s.slice(8, 10)),
];
const dayNumber = (s: string): number => daysFromCivil(...parts(s));

export const addDays = (s: string, n: number): string => fmt(...civilFromDays(dayNumber(s) + n));

/** Suma meses al dia del mes, recortandolo al ultimo dia si hace falta (31 ene + 1 mes = 28 feb). */
export function addMonths(s: string, k: number): string {
  const [y, m, d] = parts(s);
  const idx = y * 12 + (m - 1) + k;
  const ny = fl(idx / 12);
  const nm = idx - ny * 12 + 1;
  return fmt(ny, nm, Math.min(d, dim(ny, nm)));
}

/** Mes (year, month 1-12) a `delta` meses del indicado. */
export function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const idx = year * 12 + (month - 1) + delta;
  const y = fl(idx / 12);
  return [y, idx - y * 12 + 1];
}

/** Fecha local 'YYYY-MM-DD' de un instante epoch ms. */
export const localDateOf = (ms: number): string => fmt(...civilFromDays(fl((ms - BOGOTA_OFFSET) / DAY)));
/** Medianoche local de una fecha, en epoch ms. */
export const midnightMs = (s: string): number => dayNumber(s) * DAY + BOGOTA_OFFSET;
export const monthStartMs = (y: number, m: number): number => midnightMs(fmt(y, m, 1));

// ---- series ----------------------------------------------------------------

export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** La quincena (15 o ultimo dia) mas cercana; ante un empate gana la posterior. */
function nearestQuincena(s: string): string {
  const [y, m] = parts(s);
  const [py, pm] = shiftMonth(y, m, -1);
  const [ny, nm] = shiftMonth(y, m, 1);
  const candidates = [fmt(py, pm, dim(py, pm)), fmt(y, m, 15), fmt(y, m, dim(y, m)), fmt(ny, nm, 15)];
  let best = candidates[0] as string;
  for (const c of candidates) {
    if (Math.abs(dayNumber(c) - dayNumber(s)) <= Math.abs(dayNumber(best) - dayNumber(s))) best = c;
  }
  return best;
}

export const normalizeAnchor = (anchor: string, f: Frequency): string =>
  f === 'BIWEEKLY' ? nearestQuincena(anchor) : anchor;

/** true si `date` es una ocurrencia de la serie (ancla + frecuencia). */
export function inSeries(anchor: string, f: Frequency, date: string): boolean {
  const effective = normalizeAnchor(anchor, f);
  if (date < effective) return false;
  const [y, m, d] = parts(date);
  if (f === 'WEEKLY') return (dayNumber(date) - dayNumber(effective)) % 7 === 0;
  if (f === 'MONTHLY') return d === Math.min(parts(anchor)[2], dim(y, m));
  return d === 15 || d === dim(y, m);
}

/** Primera ocurrencia >= minDate de la serie sin confirmar; null si no hay en 6000 dias. */
export function nextPending(anchor: string, f: Frequency, confirmed: Set<string>, minDate: string): string | null {
  const effective = normalizeAnchor(anchor, f);
  let cur = minDate < effective ? effective : minDate;
  for (let i = 0; i < 6000; i++, cur = addDays(cur, 1)) {
    if (inSeries(anchor, f, cur) && !confirmed.has(cur)) return cur;
  }
  return null;
}
