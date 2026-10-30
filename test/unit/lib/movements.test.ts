import { describe, expect, it } from 'vitest';

import type { ActivityItem } from '../../../src/domain/services/ActivityService';
import {
  activityTotals,
  filterActivity,
  movementAccountLabel,
  movementAmount,
  movementCategoryLabel,
  movementKey,
} from '../../../src/lib/movements';

function tx(id: string, type: 'INCOME' | 'EXPENSE', amountMinor: number, over: Record<string, unknown> = {}): ActivityItem {
  return {
    kind: 'TRANSACTION',
    id,
    date: 1,
    createdAt: 1,
    transaction: { type, amountMinor, accountName: 'Nequi', categoryName: 'Comida', debtName: null, ...over },
  } as unknown as ActivityItem;
}

const transfer = {
  kind: 'TRANSFER',
  id: 'f1',
  date: 1,
  createdAt: 1,
  direction: null,
  transfer: { amountMinor: 7000, fromAccountName: 'Efectivo', toAccountName: 'Nequi' },
} as unknown as ActivityItem;

const items = [tx('a', 'INCOME', 10000), tx('b', 'EXPENSE', 3000), tx('c', 'EXPENSE', 2000), transfer];

describe('filterActivity', () => {
  it('Todos deja todo', () => expect(filterActivity(items, 'ALL')).toHaveLength(4));
  it('Ingresos', () => expect(filterActivity(items, 'INCOME').map((i) => i.id)).toEqual(['a']));
  it('Gastos', () => expect(filterActivity(items, 'EXPENSE').map((i) => i.id)).toEqual(['b', 'c']));
  it('Transferencias', () => expect(filterActivity(items, 'TRANSFER').map((i) => i.id)).toEqual(['f1']));
  it('lista vacía', () => expect(filterActivity([], 'INCOME')).toEqual([]));
});

describe('activityTotals', () => {
  it('suma ingresos y gastos e ignora transferencias', () => {
    expect(activityTotals(items)).toEqual({ incomeMinor: 10000, expenseMinor: 5000 });
  });
  it('sin datos da ceros', () => expect(activityTotals([])).toEqual({ incomeMinor: 0, expenseMinor: 0 }));
});

describe('etiquetas de fila', () => {
  it('monto con signo', () => {
    expect(movementAmount(items[0])).toBe(10000);
    expect(movementAmount(items[1])).toBe(-3000);
    expect(movementAmount(transfer)).toBe(7000);
  });
  it('cuenta: transferencia Origen → Destino', () => {
    expect(movementAccountLabel(items[0])).toBe('Nequi');
    expect(movementAccountLabel(transfer)).toBe('Efectivo → Nequi');
  });
  it('categoría: deuda, sin categoría y guion', () => {
    expect(movementCategoryLabel(tx('d', 'EXPENSE', 1, { categoryName: null, debtName: 'Tarjeta' }))).toBe('Tarjeta');
    expect(movementCategoryLabel(tx('e', 'EXPENSE', 1, { categoryName: null }))).toBe('Sin categoría');
    expect(movementCategoryLabel(transfer)).toBe('—');
  });
  it('clave distinta por tipo', () => {
    expect(movementKey(items[0])).toBe('tx:a');
    expect(movementKey(transfer)).toBe('tf:f1');
  });
});
