// Textos y calculos de presentacion del detalle del flujo (gráfico por periodo y desglose por categoria).
// Textos INFERIDOS: el diseño no trae esta pantalla (pedido de Leonardo, 2026-10-28).
import { addDays, parseLocalDate } from '../domain/dates';
import { MINOR_PER_PESO, type Minor } from '../domain/money';
import { periodMonths, type Period, type PeriodKind } from '../domain/rules/periods';
import type { CategoryLine, FlowBucket } from '../domain/services/ReportService';
import { LABEL_DEBT_EXPENSE, LABEL_GOALS_SPENT } from './cashflowView';
import { monthShortLabel, monthYearLabel } from './dateLabels';

export const PERIOD_OPTIONS: readonly { value: PeriodKind; label: string }[] = [
  { value: 'MONTH', label: 'Mes' },
  { value: 'QUARTER', label: 'Trimestre' },
  { value: 'SEMESTER', label: 'Semestre' },
  { value: 'YEAR', label: 'Año' },
];

const LABEL_UNCATEGORIZED = 'Sin categoría';

/** Título del periodo: 'Octubre 2026', 'Trimestre 4 · 2026', 'Semestre 2 · 2026' o '2026'. */
export function periodTitle(p: Period): string {
  if (p.kind === 'MONTH') return monthYearLabel(p.year, p.index);
  if (p.kind === 'QUARTER') return `Trimestre ${p.index} · ${p.year}`;
  if (p.kind === 'SEMESTER') return `Semestre ${p.index} · ${p.year}`;
  return String(p.year);
}

/** Meses que cubre un periodo de varios meses ('oct – dic'); en un mes, null. */
export function periodSpan(p: Period): string | null {
  if (p.kind === 'MONTH') return null;
  const months = periodMonths(p);
  return `${monthShortLabel(months[0].month)} – ${monthShortLabel(months[months.length - 1].month)}`;
}

/** Días de una semana del mes: '1–7', '22–31'. */
function weekDays(b: FlowBucket): string {
  return `${parseLocalDate(b.from).day}–${parseLocalDate(addDays(b.toExclusive, -1)).day}`;
}

/** Etiqueta corta bajo la barra: 'S1' en un mes, 'oct' en los demás. */
export function bucketShortLabel(kind: PeriodKind, b: FlowBucket, i: number): string {
  return kind === 'MONTH' ? `S${i + 1}` : monthShortLabel(parseLocalDate(b.from).month);
}

/** Etiqueta larga de la barra elegida: 'Semana 2 · 8–14 oct' u 'Octubre 2026'. */
export function bucketLongLabel(kind: PeriodKind, b: FlowBucket, i: number): string {
  const { year, month } = parseLocalDate(b.from);
  return kind === 'MONTH' ? `Semana ${i + 1} · ${weekDays(b)} ${monthShortLabel(month)}` : monthYearLabel(year, month);
}

export function categoryLineLabel(line: CategoryLine): string {
  if (line.group === 'DEBT') return LABEL_DEBT_EXPENSE;
  if (line.group === 'GOALS') return LABEL_GOALS_SPENT;
  return line.name ?? LABEL_UNCATEGORIZED;
}

/** Parte entera (0-100) de `part` sobre `total`; 0 si no hay total. */
export function sharePercent(part: Minor, total: Minor): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Tope "redondo" del eje (1, 2, 2,5 o 5 × 10^k) para un máximo en unidades menores; 0 si no hay datos. */
export function niceAxisMax(maxMinor: Minor): Minor {
  if (maxMinor <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(maxMinor));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= maxMinor) ?? 10;
  return step * magnitude;
}

function decimalComma(value: number): string {
  return (Math.round(value * 10) / 10).toString().replace('.', ',');
}

/** Monto corto del eje: '$1,2 M', '$500 mil', '$900'. */
export function compactCOP(minor: Minor): string {
  const pesos = Math.round(Math.abs(minor) / MINOR_PER_PESO);
  const sign = minor < 0 && pesos !== 0 ? '-' : '';
  if (pesos >= 1_000_000) return `${sign}$${decimalComma(pesos / 1_000_000)} M`;
  if (pesos >= 1_000) return `${sign}$${decimalComma(pesos / 1_000)} mil`;
  return `${sign}$${pesos}`;
}
