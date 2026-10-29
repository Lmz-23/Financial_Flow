// Filas de la lista de actividad (transacciones + transferencias), puras para probarlas en vitest.
import { toLocalDate } from '../domain/dates';
import type { ActivityItem } from '../domain/services/ActivityService';
import { transactionLabel } from './dashboardFormat';
import { relativeDateLabel } from './dateLabels';

export const TRANSFER_TITLE = 'Transferencia';

export interface ActivityRow {
  /** Clave unica de la fila (los ids de transaccion y transferencia son de tablas distintas). */
  key: string;
  kind: 'TRANSACTION' | 'TRANSFER';
  /** Id de la transaccion o de la transferencia, segun `kind`. */
  id: string;
  title: string;
  subtitle: string;
  /** Con signo: − gasto o transferencia saliente, + ingreso o entrante. Sin cuenta filtrada, una transferencia es positiva sin signo. */
  amountMinor: number;
  /** 'auto' = verde/terracota segun el signo; 'neutral' = transferencias (no son ingreso ni gasto). */
  tone: 'auto' | 'neutral';
  /** Mostrar «+» en positivos (solo transferencias entrantes en el detalle de cuenta). */
  showSign: boolean;
  /** Epoch ms de la fecha del movimiento. */
  date: number;
}

export interface ActivityRowOptions {
  /** Agrega «· Categoria» al subtitulo de las transacciones (lista de Movimientos). */
  withCategory?: boolean;
}

export function activityRow(item: ActivityItem, now: number, options: ActivityRowOptions = {}): ActivityRow {
  const day = relativeDateLabel(item.date, now);
  if (item.kind === 'TRANSACTION') {
    const tx = item.transaction;
    const category = options.withCategory ? (tx.categoryName ?? tx.debtName) : null;
    return {
      key: `tx:${item.id}`,
      kind: 'TRANSACTION',
      id: item.id,
      title: transactionLabel(tx),
      subtitle: category ? `${day} · ${category}` : day,
      amountMinor: tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor,
      tone: 'auto',
      showSign: false,
      date: item.date,
    };
  }
  const t = item.transfer;
  const detail =
    item.direction === 'OUT'
      ? `A ${t.toAccountName}`
      : item.direction === 'IN'
        ? `De ${t.fromAccountName}`
        : `${t.fromAccountName} → ${t.toAccountName}`;
  return {
    key: `tf:${item.id}`,
    kind: 'TRANSFER',
    id: item.id,
    title: TRANSFER_TITLE,
    subtitle: `${day} · ${detail}`,
    amountMinor: item.direction === 'OUT' ? -t.amountMinor : t.amountMinor,
    tone: 'neutral',
    showSign: item.direction === 'IN',
    date: item.date,
  };
}

export interface ActivityDaySection {
  key: string;
  title: string;
  data: ActivityRow[];
}

/** Agrupa filas ya ordenadas (de la mas reciente a la mas antigua) por dia local. */
export function groupActivityByDay(rows: readonly ActivityRow[], now: number): ActivityDaySection[] {
  const sections: ActivityDaySection[] = [];
  for (const row of rows) {
    const key = toLocalDate(row.date);
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.data.push(row);
    else sections.push({ key, title: relativeDateLabel(row.date, now), data: [row] });
  }
  return sections;
}
