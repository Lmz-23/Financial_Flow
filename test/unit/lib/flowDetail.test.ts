import { describe, expect, it } from 'vitest';

import {
  bucketLongLabel,
  bucketShortLabel,
  categoryLineLabel,
  compactCOP,
  niceAxisMax,
  periodSpan,
  periodTitle,
  sharePercent,
} from '../../../src/lib/flowDetail';

const week = (from: string, toExclusive: string) => ({ from, toExclusive, ingresoTotal: 0, gastoTotal: 0 });

describe('flowDetail', () => {
  it('titulos de periodo', () => {
    expect(periodTitle({ kind: 'MONTH', year: 2026, index: 10 })).toBe('Octubre 2026');
    expect(periodTitle({ kind: 'QUARTER', year: 2026, index: 4 })).toBe('Trimestre 4 · 2026');
    expect(periodTitle({ kind: 'SEMESTER', year: 2025, index: 1 })).toBe('Semestre 1 · 2025');
    expect(periodTitle({ kind: 'YEAR', year: 2025, index: 1 })).toBe('2025');
    expect(periodSpan({ kind: 'QUARTER', year: 2026, index: 4 })).toBe('oct – dic');
    expect(periodSpan({ kind: 'MONTH', year: 2026, index: 4 })).toBeNull();
  });

  it('etiquetas de barra', () => {
    expect(bucketShortLabel('MONTH', week('2026-10-08', '2026-10-15'), 1)).toBe('S2');
    expect(bucketLongLabel('MONTH', week('2026-10-22', '2026-11-01'), 3)).toBe('Semana 4 · 22–31 oct');
    expect(bucketShortLabel('YEAR', week('2026-03-01', '2026-04-01'), 2)).toBe('mar');
    expect(bucketLongLabel('QUARTER', week('2026-03-01', '2026-04-01'), 2)).toBe('Marzo 2026');
  });

  it('nombre de linea del desglose', () => {
    expect(categoryLineLabel({ key: 'a', group: 'CATEGORY', name: 'Servicios', totalMinor: 1 })).toBe('Servicios');
    expect(categoryLineLabel({ key: 'b', group: 'UNCATEGORIZED', name: null, totalMinor: 1 })).toBe('Sin categoría');
    expect(categoryLineLabel({ key: 'c', group: 'DEBT', name: null, totalMinor: 1 })).toBe('Pagos de deuda');
    expect(categoryLineLabel({ key: 'd', group: 'GOALS', name: null, totalMinor: 1 })).toBe('Metas cumplidas');
  });

  it('porcentaje, tope del eje y monto corto', () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(5, 0)).toBe(0);
    expect(niceAxisMax(0)).toBe(0);
    expect(niceAxisMax(130_000_000)).toBe(200_000_000);
    expect(niceAxisMax(240_000_000)).toBe(250_000_000);
    expect(niceAxisMax(100_000_000)).toBe(100_000_000);
    expect(compactCOP(120_000_000)).toBe('$1,2 M');
    expect(compactCOP(50_000_000)).toBe('$500 mil');
    expect(compactCOP(90_000)).toBe('$900');
    expect(compactCOP(0)).toBe('$0');
  });
});
