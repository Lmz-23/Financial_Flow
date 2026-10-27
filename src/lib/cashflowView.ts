import { isFinancialFreedom, type CashflowIndex, type MonthStatement } from '../domain/rules/statement';
import type { Minor } from '../domain/money';

/** Etiquetas del diseño (Dashboard.dc.html, onCashflow) y de §3.2 («Metas cumplidas»). */
export const LABEL_PASSIVE_INCOME = 'Ingreso pasivo';
export const LABEL_TOTAL_EXPENSE = 'Gasto total del mes';
export const LABEL_GOALS_SPENT = 'Metas cumplidas';
/** Inferidas: el diseño no desglosa el gasto; nombres tomados de gastoVida / gastoDeuda de §3.2. */
export const LABEL_LIFE_EXPENSE = 'Gastos del día a día';
export const LABEL_DEBT_EXPENSE = 'Pagos de deuda';

/** Avance de la barra (0-100): el diseño la limita a 100; libertad financiera la llena. */
export function cashflowBarProgress(index: CashflowIndex): number {
  if (index.kind === 'NONE') return 0;
  if (isFinancialFreedom(index)) return 100;
  return index.kind === 'RATIO' ? Math.min(Math.round(index.ratio * 100), 100) : 0;
}

export interface BreakdownRow {
  key: 'life' | 'debt' | 'goals';
  label: string;
  value: Minor;
}

/** Filas del desglose del gasto. Vida siempre; deuda y metas solo si tuvieron monto. */
export function expenseBreakdownRows(s: Pick<MonthStatement, 'gastoVida' | 'gastoDeuda' | 'gastoMetas'>): BreakdownRow[] {
  const rows: BreakdownRow[] = [{ key: 'life', label: LABEL_LIFE_EXPENSE, value: s.gastoVida }];
  if (s.gastoDeuda > 0) rows.push({ key: 'debt', label: LABEL_DEBT_EXPENSE, value: s.gastoDeuda });
  if (s.gastoMetas > 0) rows.push({ key: 'goals', label: LABEL_GOALS_SPENT, value: s.gastoMetas });
  return rows;
}
