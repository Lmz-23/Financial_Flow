// Cálculos de presentación de la versión de escritorio: gráfico ancho de flujo, barra del Índice
// de Flujo de Caja y tendencia de los últimos meses. Lógica pura, sin React.
import { addMonthsToYearMonth, compareLocalDates, type LocalDate } from '../domain/dates';
import type { Minor } from '../domain/money';

/** Marcas de la barra de avance del Índice (0 a 100 %). */
export const CASHFLOW_SCALE_MARKS: readonly number[] = [0, 25, 50, 75, 100];

/** Altura (0-100) de una barra respecto al tope del eje; 0 si no hay eje o el monto no es positivo. */
export function barHeightPercent(minor: Minor, axisMax: Minor): number {
  if (axisMax <= 0 || minor <= 0) return 0;
  return Math.min(100, (minor / axisMax) * 100);
}

/** Valores del eje de arriba hacia abajo: con tope 100 y 2 pasos, [100, 50, 0]. */
export function axisTicks(axisMax: Minor, steps: number): Minor[] {
  return Array.from({ length: steps + 1 }, (_, i) => (axisMax * (steps - i)) / steps);
}

/** true si el tramo empieza después de hoy (se muestra apagado, sin datos posibles). */
export function isFutureBucket(from: LocalDate, today: LocalDate): boolean {
  return compareLocalDates(from, today) > 0;
}

/** Lado donde se abre el cuadro del tramo señalado para que no se salga del gráfico. */
export function tooltipSide(index: number, count: number): 'left' | 'center' | 'right' {
  if (count < 5) return 'center';
  if (index === 0 || index === 1) return 'left';
  if (index >= count - 2) return 'right';
  return 'center';
}

/** Los últimos `count` meses terminando en (year, month), del más antiguo al actual. */
export function lastMonths(year: number, month: number, count: number): { year: number; month: number }[] {
  return Array.from({ length: count }, (_, i) => addMonthsToYearMonth(year, month, i - (count - 1)));
}

/** Altura (0-100) de cada barra de tendencia respecto al mayor valor; todas 0 si no hay valores positivos. */
export function trendHeights(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 && v > 0 ? (v / max) * 100 : 0));
}
