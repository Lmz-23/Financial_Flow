// Reparto de los widgets del Dashboard de escritorio en filas de una cuadrícula (puro, sin react-native).
import type { LayoutSize } from './layoutSize';

export type DashboardWidgetKey = 'cashflow' | 'monthFlow' | 'accounts' | 'recent' | 'upcoming' | 'debts' | 'goals';

export interface DashboardCell {
  key: DashboardWidgetKey;
  /** Columnas que ocupa (ya recortado al número de columnas de la cuadrícula). */
  span: number;
}

export interface OptionalWidgets {
  cashflow: boolean;
  debts: boolean;
  goals: boolean;
}

/** Columnas de la cuadrícula: 3 en 'wide', 2 en 'medium'. */
export function dashboardColumns(size: LayoutSize): number {
  return size === 'wide' ? 3 : 2;
}

/**
 * Orden del diseño 2a: Índice de Flujo de Caja (si está activo), Flujo del mes y Resumen de cuentas;
 * Movimientos recientes (2 columnas) y Próximos pagos; Deudas y Metas (si están activos).
 * Se llenan las filas en orden; una fila incompleta deja el resto vacío.
 */
export function dashboardRows(size: LayoutSize, active: OptionalWidgets): DashboardCell[][] {
  const columns = dashboardColumns(size);
  const order: DashboardCell[] = [
    ...(active.cashflow ? [{ key: 'cashflow' as const, span: 1 }] : []),
    { key: 'monthFlow', span: 1 },
    { key: 'accounts', span: 1 },
    { key: 'recent', span: 2 },
    { key: 'upcoming', span: 1 },
    ...(active.debts ? [{ key: 'debts' as const, span: 1 }] : []),
    ...(active.goals ? [{ key: 'goals' as const, span: 1 }] : []),
  ];
  const rows: DashboardCell[][] = [];
  let used = 0;
  for (const item of order) {
    const span = Math.min(item.span, columns);
    if (rows.length === 0 || used + span > columns) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push({ key: item.key, span });
    used += span;
  }
  return rows;
}
