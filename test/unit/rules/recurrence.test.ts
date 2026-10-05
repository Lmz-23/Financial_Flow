import { describe, expect, it } from 'vitest';
import {
  iterateOccurrences,
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
  it('SUPUESTO: el ancla fuera de quincena es la primera ocurrencia', () => {
    expect(take('2025-03-10', 'BIWEEKLY', 4)).toEqual([
      '2025-03-10',
      '2025-03-15',
      '2025-03-31',
      '2025-04-15',
    ]);
    expect(take('2025-03-20', 'BIWEEKLY', 3)).toEqual(['2025-03-20', '2025-03-31', '2025-04-15']);
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
