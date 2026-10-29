// Calculos de presentacion del Dashboard, puros (sin react-native) para poder probarlos en vitest.
import type { TransactionView } from '../database/repositories/transactionRepository';

/** Parte de ingresos en la barra "Flujo del mes" (Dashboard.dc.html ~1196): 50/50 si no hay movimiento. */
export function incomeSharePercent(ingresoTotal: number, gastoTotal: number): number {
  const total = ingresoTotal + gastoTotal;
  return total > 0 ? Math.round((ingresoTotal / total) * 100) : 50;
}

/** Texto de una fila de movimiento: la descripcion; si esta vacia, la categoria, la deuda o el tipo. */
export function transactionLabel(tx: Pick<TransactionView, 'description' | 'categoryName' | 'debtName' | 'type'>): string {
  return tx.description.trim() || tx.categoryName || tx.debtName || (tx.type === 'INCOME' ? 'Ingreso' : 'Gasto');
}

export function goalsCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'meta activa' : 'metas activas'}`;
}
