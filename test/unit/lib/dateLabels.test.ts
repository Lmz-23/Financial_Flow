import { describe, expect, it } from 'vitest';

import { relativeDateLabel, shortDateLabel } from '../../../src/lib/dateLabels';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
// 2026-10-08 es jueves.
const NOW = at(2026, 10, 8);

describe('shortDateLabel', () => {
  it('formato del diseno: dia y mes abreviado', () => {
    expect(shortDateLabel('2026-10-15')).toBe('15 oct');
    expect(shortDateLabel('2026-01-03')).toBe('3 ene');
    expect(shortDateLabel('2026-12-31')).toBe('31 dic');
  });
});

describe('relativeDateLabel', () => {
  it('Hoy, Ayer y dia de la semana', () => {
    expect(relativeDateLabel(at(2026, 10, 8, 0), NOW)).toBe('Hoy');
    expect(relativeDateLabel(at(2026, 10, 8, 23), at(2026, 10, 8, 1))).toBe('Hoy');
    expect(relativeDateLabel(at(2026, 10, 7), NOW)).toBe('Ayer');
    expect(relativeDateLabel(at(2026, 10, 6), NOW)).toBe('Mar');
    expect(relativeDateLabel(at(2026, 10, 2), NOW)).toBe('Vie');
  });

  it('desde 7 dias atras y las fechas futuras usan dia y mes', () => {
    expect(relativeDateLabel(at(2026, 10, 1), NOW)).toBe('1 oct');
    expect(relativeDateLabel(at(2026, 9, 20), NOW)).toBe('20 sep');
    expect(relativeDateLabel(at(2026, 10, 9), NOW)).toBe('9 oct');
  });

  it('cruza el limite de mes y de anio', () => {
    expect(relativeDateLabel(at(2026, 2, 28), at(2026, 3, 1))).toBe('Ayer');
    expect(relativeDateLabel(at(2025, 12, 31), at(2026, 1, 1))).toBe('Ayer');
  });
});
