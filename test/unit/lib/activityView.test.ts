import { describe, expect, it } from 'vitest';

import { localDateToEpochMs } from '../../../src/domain/dates';
import type { ActivityItem } from '../../../src/domain/services/ActivityService';
import { activityRow, groupActivityByDay } from '../../../src/lib/activityView';

const NOW = localDateToEpochMs('2026-10-27', 15);
const TODAY = localDateToEpochMs('2026-10-27', 12);
const YESTERDAY = localDateToEpochMs('2026-10-26', 12);

function tx(over: Record<string, unknown> = {}): ActivityItem {
  return {
    kind: 'TRANSACTION',
    id: 't1',
    date: TODAY,
    createdAt: TODAY,
    transaction: {
      type: 'EXPENSE',
      amountMinor: 5000,
      description: '',
      categoryName: 'Comida',
      debtName: null,
      ...over,
    },
  } as unknown as ActivityItem;
}

function transfer(direction: 'IN' | 'OUT' | null, date = TODAY): ActivityItem {
  return {
    kind: 'TRANSFER',
    id: 'f1',
    date,
    createdAt: date,
    direction,
    transfer: { amountMinor: 20000, fromAccountName: 'Nequi', toAccountName: 'Ahorros' },
  } as unknown as ActivityItem;
}

describe('activityRow', () => {
  it('gasto: negativo, tono automatico, sin categoria por defecto', () => {
    const row = activityRow(tx(), NOW);
    expect(row).toMatchObject({ kind: 'TRANSACTION', key: 'tx:t1', title: 'Comida', subtitle: 'Hoy', amountMinor: -5000, tone: 'auto' });
  });
  it('ingreso: positivo; con categoria en el subtitulo', () => {
    const row = activityRow(tx({ type: 'INCOME' }), NOW, { withCategory: true });
    expect(row.amountMinor).toBe(5000);
    expect(row.subtitle).toBe('Hoy · Comida');
  });
  it('transferencia sin filtro: Desde → Hacia, neutra y sin signo', () => {
    const row = activityRow(transfer(null), NOW);
    expect(row).toMatchObject({ kind: 'TRANSFER', key: 'tf:f1', title: 'Transferencia', subtitle: 'Hoy · Nequi → Ahorros', amountMinor: 20000, tone: 'neutral', showSign: false });
  });
  it('transferencia saliente: «A», negativa', () => {
    const row = activityRow(transfer('OUT'), NOW);
    expect(row.subtitle).toBe('Hoy · A Ahorros');
    expect(row.amountMinor).toBe(-20000);
  });
  it('transferencia entrante: «De», positiva con signo', () => {
    const row = activityRow(transfer('IN'), NOW);
    expect(row.subtitle).toBe('Hoy · De Nequi');
    expect(row.amountMinor).toBe(20000);
    expect(row.showSign).toBe(true);
  });
});

describe('groupActivityByDay', () => {
  it('agrupa por dia local conservando el orden', () => {
    const rows = [activityRow(tx(), NOW), activityRow(transfer(null), NOW), activityRow(transfer(null, YESTERDAY), NOW)];
    const sections = groupActivityByDay(rows, NOW);
    expect(sections.map((s) => [s.title, s.data.length])).toEqual([
      ['Hoy', 2],
      ['Ayer', 1],
    ]);
  });
  it('vacio: sin secciones', () => expect(groupActivityByDay([], NOW)).toEqual([]));
});
