// Filtros y totales de Movimientos en escritorio, puros para probarlos en vitest.
import type { ActivityItem } from '../domain/services/ActivityService';

export type MovementFilter = 'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

export const MOVEMENT_FILTERS: readonly { value: MovementFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'INCOME', label: 'Ingresos' },
  { value: 'EXPENSE', label: 'Gastos' },
  { value: 'TRANSFER', label: 'Transferencias' },
];

/** Gasto = transacción de tipo EXPENSE (incluye pagos de deuda); las transferencias no son ni ingreso ni gasto. */
export function matchesFilter(item: ActivityItem, filter: MovementFilter): boolean {
  if (filter === 'ALL') return true;
  if (item.kind === 'TRANSFER') return filter === 'TRANSFER';
  return item.transaction.type === filter;
}

export function filterActivity(items: readonly ActivityItem[], filter: MovementFilter): ActivityItem[] {
  return items.filter((item) => matchesFilter(item, filter));
}

export interface MovementTotals {
  incomeMinor: number;
  /** Positivo (suma de montos de gasto). */
  expenseMinor: number;
}

/** Totales del periodo: las transferencias no cuentan. */
export function activityTotals(items: readonly ActivityItem[]): MovementTotals {
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const item of items) {
    if (item.kind !== 'TRANSACTION') continue;
    if (item.transaction.type === 'INCOME') incomeMinor += item.transaction.amountMinor;
    else expenseMinor += item.transaction.amountMinor;
  }
  return { incomeMinor, expenseMinor };
}

/** Monto con signo: + ingreso, − gasto; una transferencia sin cuenta filtrada va positiva. */
export function movementAmount(item: ActivityItem): number {
  if (item.kind === 'TRANSFER') return item.transfer.amountMinor;
  return item.transaction.type === 'INCOME' ? item.transaction.amountMinor : -item.transaction.amountMinor;
}

/** Columna «Cuenta»: la cuenta de la transacción o «Origen → Destino». */
export function movementAccountLabel(item: ActivityItem): string {
  if (item.kind === 'TRANSFER') return `${item.transfer.fromAccountName} → ${item.transfer.toAccountName}`;
  return item.transaction.accountName;
}

export const NO_CATEGORY_LABEL = 'Sin categoría';

/** Columna «Categoría»: guion en transferencias; los pagos de deuda muestran la deuda. */
export function movementCategoryLabel(item: ActivityItem): string {
  if (item.kind === 'TRANSFER') return '—';
  return item.transaction.categoryName ?? item.transaction.debtName ?? NO_CATEGORY_LABEL;
}

/** Clave estable de fila (los ids de transacción y transferencia son de tablas distintas). */
export function movementKey(item: ActivityItem): string {
  return `${item.kind === 'TRANSACTION' ? 'tx' : 'tf'}:${item.id}`;
}
