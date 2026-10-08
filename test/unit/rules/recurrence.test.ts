import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsToYearMonth,
  daysInMonth,
  diffDays,
  formatLocalDate,
  parseLocalDate,
} from '../../../src/domain/dates';
import {
  isOccurrenceOfSeries,
  iterateOccurrences,
  nearestBiweeklyDate,
  normalizeAnchor,
  nextOccurrenceAfter,
  nextPendingOccurrence,
  occurrencesInMonth,
  occurrencesInRange,
  type Frequency,
} from '../../../src/domain/rules/recurrence';

function take(anchor: string, freq: Frequency, n: number): string[] {
  const out: string[] = [];
  for (const d of iterateOccurrences(anchor, freq)) {
    out.push(d);
    if (out.length === n) break;
  }
  return out;
}

describe('MONTHLY', () => {
  it('día 31: 28 feb -> 31 mar, sin deriva (año no bisiesto)', () => {
    expect(take('2025-01-31', 'MONTHLY', 6)).toEqual([
      '2025-01-31',
      '2025-02-28',
      '2025-03-31',
      '2025-04-30',
      '2025-05-31',
      '2025-06-30',
    ]);
  });

  it('día 31 en año bisiesto: 29 feb', () => {
    expect(take('2024-01-31', 'MONTHLY', 3)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
  });

  it('día 29 y 30 con febrero', () => {
    expect(take('2025-01-30', 'MONTHLY', 3)).toEqual(['2025-01-30', '2025-02-28', '2025-03-30']);
    expect(take('2025-01-29', 'MONTHLY', 2)).toEqual(['2025-01-29', '2025-02-28']);
    expect(take('2024-01-29', 'MONTHLY', 2)).toEqual(['2024-01-29', '2024-02-29']);
  });

  it('cambio de año', () => {
    expect(take('2025-11-15', 'MONTHLY', 4)).toEqual([
      '2025-11-15',
      '2025-12-15',
      '2026-01-15',
      '2026-02-15',
    ]);
    expect(take('2025-12-31', 'MONTHLY', 2)).toEqual(['2025-12-31', '2026-01-31']);
  });

  it('un ancla en febrero (28) no se queda en 28: conserva el día del ancla', () => {
    expect(take('2025-02-28', 'MONTHLY', 3)).toEqual(['2025-02-28', '2025-03-28', '2025-04-28']);
  });
});

describe('WEEKLY', () => {
  it('+7 días a través de fin de mes y de año', () => {
    expect(take('2025-01-25', 'WEEKLY', 3)).toEqual(['2025-01-25', '2025-02-01', '2025-02-08']);
    expect(take('2025-12-27', 'WEEKLY', 3)).toEqual(['2025-12-27', '2026-01-03', '2026-01-10']);
    expect(take('2024-02-26', 'WEEKLY', 3)).toEqual(['2024-02-26', '2024-03-04', '2024-03-11']);
  });
});

describe('BIWEEKLY (15 y último día del mes)', () => {
  it('mes de 31 días', () => {
    expect(occurrencesInMonth('2025-01-15', 'BIWEEKLY', 2025, 1)).toEqual(['2025-01-15', '2025-01-31']);
  });
  it('mes de 30 días', () => {
    expect(occurrencesInMonth('2025-01-15', 'BIWEEKLY', 2025, 4)).toEqual(['2025-04-15', '2025-04-30']);
  });
  it('febrero de 28 días', () => {
    expect(occurrencesInMonth('2025-01-15', 'BIWEEKLY', 2025, 2)).toEqual(['2025-02-15', '2025-02-28']);
  });
  it('febrero de 29 días', () => {
    expect(occurrencesInMonth('2024-01-15', 'BIWEEKLY', 2024, 2)).toEqual(['2024-02-15', '2024-02-29']);
  });
  it('cruza de año', () => {
    expect(take('2025-12-15', 'BIWEEKLY', 4)).toEqual([
      '2025-12-15',
      '2025-12-31',
      '2026-01-15',
      '2026-01-31',
    ]);
  });
  it('ancla BIWEEKLY no normalizada: la secuencia parte de la fecha normalizada', () => {
    // 10 mar -> 15 mar (5) vs 28 feb (10)
    expect(take('2025-03-10', 'BIWEEKLY', 3)).toEqual(['2025-03-15', '2025-03-31', '2025-04-15']);
    // 20 mar -> 15 mar (5) vs 31 mar (11)
    expect(take('2025-03-20', 'BIWEEKLY', 3)).toEqual(['2025-03-15', '2025-03-31', '2025-04-15']);
    // 1 mar -> 28 feb
    expect(take('2025-03-01', 'BIWEEKLY', 3)).toEqual(['2025-02-28', '2025-03-15', '2025-03-31']);
  });
  it('occurrencesInMonth y nextPendingOccurrence con ancla no normalizada', () => {
    expect(occurrencesInMonth('2025-03-10', 'BIWEEKLY', 2025, 3)).toEqual(['2025-03-15', '2025-03-31']);
    expect(occurrencesInMonth('2025-03-01', 'BIWEEKLY', 2025, 3)).toEqual(['2025-03-15', '2025-03-31']);
    expect(occurrencesInMonth('2025-03-01', 'BIWEEKLY', 2025, 2)).toEqual(['2025-02-28']);
    expect(nextPendingOccurrence({ anchor: '2025-03-10', frequency: 'BIWEEKLY', confirmed: [] })).toBe(
      '2025-03-15',
    );
    expect(
      nextPendingOccurrence({ anchor: '2025-03-01', frequency: 'BIWEEKLY', confirmed: ['2025-02-28'] }),
    ).toBe('2025-03-15');
    expect(nextOccurrenceAfter('2025-03-10', 'BIWEEKLY', '2025-01-01')).toBe('2025-03-15');
  });
});

describe('nearestBiweeklyDate', () => {
  it('mes de 31 días', () => {
    expect(nearestBiweeklyDate('2025-03-01')).toBe('2025-02-28'); // 1 vs 14
    expect(nearestBiweeklyDate('2025-03-07')).toBe('2025-02-28'); // 7 vs 8
    expect(nearestBiweeklyDate('2025-03-08')).toBe('2025-03-15'); // 7 vs 8
    expect(nearestBiweeklyDate('2025-03-20')).toBe('2025-03-15');
    expect(nearestBiweeklyDate('2025-03-22')).toBe('2025-03-15'); // 7 vs 9
    expect(nearestBiweeklyDate('2025-03-24')).toBe('2025-03-31'); // 9 vs 7
  });
  it('mes de 30 días (sin empates)', () => {
    expect(nearestBiweeklyDate('2025-04-01')).toBe('2025-03-31');
    expect(nearestBiweeklyDate('2025-04-07')).toBe('2025-03-31');
    expect(nearestBiweeklyDate('2025-04-08')).toBe('2025-04-15');
    expect(nearestBiweeklyDate('2025-04-22')).toBe('2025-04-15'); // 7 vs 8
    expect(nearestBiweeklyDate('2025-04-23')).toBe('2025-04-30'); // 8 vs 7
  });
  it('febrero de 28 días (sin empates)', () => {
    expect(nearestBiweeklyDate('2025-02-01')).toBe('2025-01-31');
    expect(nearestBiweeklyDate('2025-02-08')).toBe('2025-02-15');
    expect(nearestBiweeklyDate('2025-02-21')).toBe('2025-02-15'); // 6 vs 7
    expect(nearestBiweeklyDate('2025-02-22')).toBe('2025-02-28'); // 7 vs 6
  });
  it('febrero de 29 días', () => {
    expect(nearestBiweeklyDate('2024-02-21')).toBe('2024-02-15'); // 6 vs 8
    expect(nearestBiweeklyDate('2024-02-23')).toBe('2024-02-29'); // 8 vs 6
    expect(nearestBiweeklyDate('2024-03-01')).toBe('2024-02-29');
  });
  it('cambio de año hacia atrás y hacia delante', () => {
    expect(nearestBiweeklyDate('2026-01-01')).toBe('2025-12-31');
    expect(nearestBiweeklyDate('2026-01-07')).toBe('2025-12-31');
    expect(nearestBiweeklyDate('2026-01-08')).toBe('2026-01-15');
    expect(nearestBiweeklyDate('2025-12-30')).toBe('2025-12-31');
    expect(nearestBiweeklyDate('2025-12-20')).toBe('2025-12-15');
  });
  it('idempotente con 15 y con último día', () => {
    for (const d of ['2025-01-15', '2025-01-31', '2025-02-28', '2024-02-29', '2025-04-30', '2025-12-31']) {
      expect(nearestBiweeklyDate(d)).toBe(d);
    }
  });
  it('EMPATES: gana la fecha posterior (decision confirmada)', () => {
    // mes de 31 días: día 23 -> 15 (8) vs 31 (8) -> 31
    expect(nearestBiweeklyDate('2025-01-23')).toBe('2025-01-31');
    expect(nearestBiweeklyDate('2025-03-23')).toBe('2025-03-31');
    expect(nearestBiweeklyDate('2025-12-23')).toBe('2025-12-31');
    // febrero de 29 días: día 22 -> 15 (7) vs 29 (7) -> 29
    expect(nearestBiweeklyDate('2024-02-22')).toBe('2024-02-29');
    // meses de 30 y de 28 días: día 22 / 21 no son empate
    expect(nearestBiweeklyDate('2025-04-22')).toBe('2025-04-15');
    expect(nearestBiweeklyDate('2025-02-21')).toBe('2025-02-15');
  });
  it('barrido exhaustivo 2023-2026 (incluye bisiesto 2024): válida y ninguna candidata más cerca', () => {
    let count = 0;
    for (let date = '2023-01-01'; date < '2027-01-01'; date = addDays(date, 1)) {
      count++;
      const result = nearestBiweeklyDate(date);
      const r = parseLocalDate(result);
      expect(r.day === 15 || r.day === daysInMonth(r.year, r.month)).toBe(true);
      const best = Math.abs(diffDays(date, result));
      // Todas las quincenas válidas en el entorno (mes anterior, actual, siguiente).
      const { year, month } = parseLocalDate(date);
      for (const delta of [-2, -1, 0, 1, 2]) {
        const ym = addMonthsToYearMonth(year, month, delta);
        for (const day of [15, daysInMonth(ym.year, ym.month)]) {
          const other = formatLocalDate(ym.year, ym.month, day);
          expect(Math.abs(diffDays(date, other))).toBeGreaterThanOrEqual(best);
          // empate: debe ganar la posterior
          if (Math.abs(diffDays(date, other)) === best) expect(result >= other).toBe(true);
        }
      }
    }
    expect(count).toBe(1461);
  });
});

describe('normalizeAnchor', () => {
  it('BIWEEKLY fuera de quincena: ajusta y conserva el original', () => {
    expect(normalizeAnchor('2025-03-01', 'BIWEEKLY')).toEqual({
      date: '2025-02-28',
      adjusted: true,
      original: '2025-03-01',
    });
    expect(normalizeAnchor('2025-03-10', 'BIWEEKLY')).toEqual({
      date: '2025-03-15',
      adjusted: true,
      original: '2025-03-10',
    });
  });
  it('BIWEEKLY ya válida: adjusted false', () => {
    expect(normalizeAnchor('2025-03-15', 'BIWEEKLY')).toEqual({
      date: '2025-03-15',
      adjusted: false,
      original: '2025-03-15',
    });
    expect(normalizeAnchor('2024-02-29', 'BIWEEKLY').adjusted).toBe(false);
  });
  it('MONTHLY y WEEKLY: sin cambios', () => {
    for (const f of ['MONTHLY', 'WEEKLY'] as const) {
      expect(normalizeAnchor('2025-03-10', f)).toEqual({
        date: '2025-03-10',
        adjusted: false,
        original: '2025-03-10',
      });
    }
  });
});

describe('rangos y siguiente ocurrencia', () => {
  it('occurrencesInRange es [from, toExclusive)', () => {
    expect(occurrencesInRange('2025-01-31', 'MONTHLY', '2025-02-28', '2025-04-30')).toEqual([
      '2025-02-28',
      '2025-03-31',
    ]);
  });

  it('occurrencesInMonth de un mes anterior al ancla es vacío', () => {
    expect(occurrencesInMonth('2025-06-10', 'MONTHLY', 2025, 3)).toEqual([]);
  });

  it('semanal puede tener 5 ocurrencias en un mes', () => {
    expect(occurrencesInMonth('2025-01-01', 'WEEKLY', 2025, 1)).toEqual([
      '2025-01-01',
      '2025-01-08',
      '2025-01-15',
      '2025-01-22',
      '2025-01-29',
    ]);
  });

  it('nextOccurrenceAfter es estrictamente posterior', () => {
    expect(nextOccurrenceAfter('2025-01-31', 'MONTHLY', '2025-01-31')).toBe('2025-02-28');
    expect(nextOccurrenceAfter('2025-01-31', 'MONTHLY', '2025-02-27')).toBe('2025-02-28');
    expect(nextOccurrenceAfter('2025-01-31', 'MONTHLY', '2024-01-01')).toBe('2025-01-31');
    expect(nextOccurrenceAfter('2025-01-15', 'BIWEEKLY', '2025-01-15')).toBe('2025-01-31');
  });
});

describe('nextPendingOccurrence', () => {
  it('sin confirmadas devuelve el ancla', () => {
    expect(nextPendingOccurrence({ anchor: '2025-01-31', frequency: 'MONTHLY', confirmed: [] })).toBe(
      '2025-01-31',
    );
  });

  it('salta las confirmadas desde el ancla (nunca desde "ahora")', () => {
    expect(
      nextPendingOccurrence({
        anchor: '2025-01-31',
        frequency: 'MONTHLY',
        confirmed: ['2025-01-31', '2025-02-28'],
      }),
    ).toBe('2025-03-31');
  });

  it('una ocurrencia intermedia sin confirmar sigue pendiente (hueco)', () => {
    expect(
      nextPendingOccurrence({
        anchor: '2025-01-15',
        frequency: 'MONTHLY',
        confirmed: ['2025-01-15', '2025-03-15'],
      }),
    ).toBe('2025-02-15');
  });

  it('respeta minDate', () => {
    expect(
      nextPendingOccurrence({
        anchor: '2025-01-15',
        frequency: 'MONTHLY',
        confirmed: [],
        minDate: '2025-03-01',
      }),
    ).toBe('2025-03-15');
    expect(
      nextPendingOccurrence({
        anchor: '2025-01-15',
        frequency: 'WEEKLY',
        confirmed: ['2025-03-05'],
        minDate: '2025-03-05',
      }),
    ).toBe('2025-03-12');
  });

  it('acepta un Set y quincenal', () => {
    expect(
      nextPendingOccurrence({
        anchor: '2025-02-15',
        frequency: 'BIWEEKLY',
        confirmed: new Set(['2025-02-15']),
      }),
    ).toBe('2025-02-28');
  });
});

describe('isOccurrenceOfSeries', () => {
  const FREQS: Frequency[] = ['MONTHLY', 'WEEKLY', 'BIWEEKLY'];

  /** Anclas: cada dia de 2024-01-25..2024-03-05 (bisiesto) y los dias 29, 30 y 31 de cada mes de 2023-2025. */
  function anchors(): string[] {
    const out = new Set<string>();
    for (let a = '2024-01-25'; a <= '2024-03-05'; a = addDays(a, 1)) out.add(a);
    for (let y = 2023; y <= 2025; y++) {
      for (let m = 1; m <= 12; m++) {
        for (const day of [29, 30, 31]) {
          if (day <= daysInMonth(y, m)) out.add(formatLocalDate(y, m, day));
        }
      }
    }
    return [...out];
  }

  it.each(FREQS)('coincide con iterateOccurrences para muchas anclas y 4 anios (%s)', (freq) => {
    for (const anchor of anchors()) {
      const start = addDays(anchor, -40);
      const end = addDays(anchor, 4 * 366);
      const series = new Set<string>();
      for (const occ of iterateOccurrences(anchor, freq)) {
        if (occ > end) break;
        series.add(occ);
      }
      for (let day = start; day <= end; day = addDays(day, 1)) {
        const expected = series.has(day);
        if (isOccurrenceOfSeries(anchor, freq, day) !== expected) {
          throw new Error(`${freq} ancla ${anchor} fecha ${day}: esperado ${expected}`);
        }
      }
    }
  }, 60_000);

  it('casos puntuales', () => {
    expect(isOccurrenceOfSeries('2026-03-15', 'MONTHLY', '2026-03-20')).toBe(false);
    expect(isOccurrenceOfSeries('2026-03-15', 'MONTHLY', '2026-02-15')).toBe(false); // anterior al ancla
    expect(isOccurrenceOfSeries('2026-03-15', 'MONTHLY', '2026-03-15')).toBe(true);
    expect(isOccurrenceOfSeries('2026-01-31', 'MONTHLY', '2026-02-28')).toBe(true);
    expect(isOccurrenceOfSeries('2026-01-31', 'MONTHLY', '2026-02-27')).toBe(false);
    expect(isOccurrenceOfSeries('2028-01-30', 'MONTHLY', '2028-02-29')).toBe(true);
    expect(isOccurrenceOfSeries('2026-03-02', 'WEEKLY', '2026-03-16')).toBe(true);
    expect(isOccurrenceOfSeries('2026-03-02', 'WEEKLY', '2026-03-17')).toBe(false);
    expect(isOccurrenceOfSeries('2026-03-02', 'WEEKLY', '2026-02-23')).toBe(false);
    // BIWEEKLY: el ancla 10 de marzo se normaliza a 15 de marzo; el 28 de feb es anterior.
    expect(isOccurrenceOfSeries('2026-03-10', 'BIWEEKLY', '2026-03-15')).toBe(true);
    expect(isOccurrenceOfSeries('2026-03-10', 'BIWEEKLY', '2026-02-28')).toBe(false);
    expect(isOccurrenceOfSeries('2026-03-10', 'BIWEEKLY', '2026-03-31')).toBe(true);
    expect(isOccurrenceOfSeries('2026-03-10', 'BIWEEKLY', '2026-03-30')).toBe(false);
    expect(isOccurrenceOfSeries('2028-02-29', 'BIWEEKLY', '2028-03-15')).toBe(true);
  });

  it('una fecha invalida no pertenece a ninguna serie', () => {
    expect(isOccurrenceOfSeries('2026-03-15', 'MONTHLY', '2026-02-30')).toBe(false);
    expect(isOccurrenceOfSeries('2026-03-15', 'MONTHLY', 'hola')).toBe(false);
  });
});
