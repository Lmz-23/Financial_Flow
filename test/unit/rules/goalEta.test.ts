import { describe, expect, it } from 'vitest';
import { addDays, addMonthsToYearMonth, daysInMonth, formatLocalDate, parseLocalDate, toLocalDate } from '../../../src/domain/dates';
import { goalEta, type GoalEtaContribution } from '../../../src/domain/rules/goalEta';

/** Instante local (zona de vitest: America/Bogota). month 1-12. */
const ms = (y: number, m: number, d: number, h = 12, min = 0, s = 0, milli = 0): number =>
  new Date(y, m - 1, d, h, min, s, milli).getTime();

const c = (date: number, amountMinor: number): GoalEtaContribution => ({ date, amountMinor });

const NOW = ms(2026, 10, 5);

describe('goalEta: REACHED', () => {
  it('saved == objetivo y saved > objetivo', () => {
    expect(goalEta({ contributions: [], savedMinor: 1000, targetMinor: 1000, targetDate: null, now: NOW })).toEqual({ kind: 'REACHED' });
    expect(goalEta({ contributions: [], savedMinor: 1500, targetMinor: 1000, targetDate: null, now: NOW })).toEqual({ kind: 'REACHED' });
  });

  it('gana a la fecha objetivo y al ritmo', () => {
    const contributions = [c(ms(2026, 10, 1), 500)];
    expect(goalEta({ contributions, savedMinor: 1000, targetMinor: 1000, targetDate: '2026-12-31', now: NOW })).toEqual({ kind: 'REACHED' });
  });
});

describe('goalEta: BY_TARGET_DATE (precede al ritmo)', () => {
  it('devuelve la fecha y el aporte mensual necesario (sin mirar los aportes)', () => {
    // 2026-10-05 -> 2026-12-31: addMonths(hoy, 2) = 12-05 < 12-31, asi que son 3 meses.
    const eta = goalEta({ contributions: [c(ms(2026, 10, 1), 999_999)], savedMinor: 100_000, targetMinor: 1_000_000, targetDate: '2026-12-31', now: NOW });
    expect(eta).toEqual({ kind: 'BY_TARGET_DATE', date: '2026-12-31', overdue: false, monthsLeft: 3, requiredMonthlyMinor: 300_000 });
  });

  it('con targetDate gana aunque no haya aportes (no es UNKNOWN)', () => {
    const eta = goalEta({ contributions: [], savedMinor: 0, targetMinor: 1000, targetDate: '2026-11-05', now: NOW });
    expect(eta).toMatchObject({ kind: 'BY_TARGET_DATE', monthsLeft: 1, requiredMonthlyMinor: 1000 });
  });

  it('el aporte necesario se redondea hacia arriba', () => {
    const eta = goalEta({ contributions: [], savedMinor: 0, targetMinor: 1000, targetDate: '2027-01-05', now: NOW });
    expect(eta).toMatchObject({ monthsLeft: 3, requiredMonthlyMinor: 334 });
  });

  it('un mes exacto cuenta como 1 y un dia mas como 2', () => {
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 900, targetDate: '2026-11-05', now: NOW })).toMatchObject({ monthsLeft: 1 });
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 900, targetDate: '2026-11-06', now: NOW })).toMatchObject({ monthsLeft: 2, requiredMonthlyMinor: 450 });
  });

  it('fecha objetivo hoy: 1 mes, no vencida', () => {
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 900, targetDate: '2026-10-05', now: NOW })).toMatchObject({ overdue: false, monthsLeft: 1, requiredMonthlyMinor: 900 });
  });

  it('fecha objetivo pasada: vencida, 0 meses, falta todo ya', () => {
    const eta = goalEta({ contributions: [], savedMinor: 200, targetMinor: 1000, targetDate: '2026-09-30', now: NOW });
    expect(eta).toEqual({ kind: 'BY_TARGET_DATE', date: '2026-09-30', overdue: true, monthsLeft: 0, requiredMonthlyMinor: 800 });
  });

  it('cruza el fin de anio', () => {
    const now = ms(2026, 12, 20);
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 600, targetDate: '2027-03-20', now })).toMatchObject({ monthsLeft: 3, requiredMonthlyMinor: 200 });
  });

  it('fin de mes: 31 de enero + k meses se ajusta al ultimo dia del mes', () => {
    const now = ms(2026, 1, 31);
    // addMonths(31 ene, 1) = 28 feb < 1 mar -> 2 meses.
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 600, targetDate: '2026-03-01', now })).toMatchObject({ monthsLeft: 2 });
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 600, targetDate: '2026-02-28', now })).toMatchObject({ monthsLeft: 1 });
  });
});

describe('goalEta: BY_PACE (ultimos 3 meses calendario locales)', () => {
  it('promedio = suma de aportes en [inicio de hace 2 meses, now] / 3', () => {
    // Ventana: 2026-08-01 00:00 .. now (2026-10-05 12:00). Suma 300_000 -> 100_000 al mes.
    const contributions = [c(ms(2026, 8, 10), 100_000), c(ms(2026, 9, 10), 100_000), c(ms(2026, 10, 1), 100_000)];
    const eta = goalEta({ contributions, savedMinor: 300_000, targetMinor: 1_000_000, targetDate: null, now: NOW });
    // faltan 700_000 / 100_000 = 7 meses -> 2027-05-05
    expect(eta).toEqual({ kind: 'BY_PACE', date: '2027-05-05', monthsLeft: 7, monthlyAverageMinor: 100_000 });
  });

  it('los meses restantes se redondean hacia arriba', () => {
    const contributions = [c(ms(2026, 10, 1), 300_000)]; // 100_000/mes
    const eta = goalEta({ contributions, savedMinor: 300_000, targetMinor: 1_000_001, targetDate: null, now: NOW });
    expect(eta).toMatchObject({ kind: 'BY_PACE', monthsLeft: 8 });
  });

  it('divide entre 3 aunque solo haya aportes en el mes actual', () => {
    const eta = goalEta({ contributions: [c(ms(2026, 10, 2), 300)], savedMinor: 300, targetMinor: 1000, targetDate: null, now: NOW });
    // 100/mes, faltan 700 -> 7 meses
    expect(eta).toMatchObject({ kind: 'BY_PACE', monthsLeft: 7, monthlyAverageMinor: 100 });
  });

  it('sin aportes: UNKNOWN', () => {
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 1000, targetDate: null, now: NOW })).toEqual({ kind: 'UNKNOWN' });
  });

  it('aportes solo de hace 4 meses (fuera de ventana): UNKNOWN', () => {
    const contributions = [c(ms(2026, 6, 15), 500), c(ms(2026, 7, 31, 23, 59, 59, 999), 500)];
    expect(goalEta({ contributions, savedMinor: 1000, targetMinor: 5000, targetDate: null, now: NOW })).toEqual({ kind: 'UNKNOWN' });
  });

  it('frontera de mes local: 31-jul 23:59:59.999 queda fuera; 1-ago 00:00:00.000 entra', () => {
    const out = goalEta({ contributions: [c(ms(2026, 7, 31, 23, 59, 59, 999), 3000)], savedMinor: 3000, targetMinor: 6000, targetDate: null, now: NOW });
    expect(out).toEqual({ kind: 'UNKNOWN' });
    const inside = goalEta({ contributions: [c(ms(2026, 8, 1, 0, 0, 0, 0), 3000)], savedMinor: 3000, targetMinor: 6000, targetDate: null, now: NOW });
    expect(inside).toMatchObject({ kind: 'BY_PACE', monthlyAverageMinor: 1000, monthsLeft: 3 });
  });

  it('aportes posteriores a now no cuentan', () => {
    const eta = goalEta({ contributions: [c(NOW + 1, 3000)], savedMinor: 0, targetMinor: 6000, targetDate: null, now: NOW });
    expect(eta).toEqual({ kind: 'UNKNOWN' });
    const edge = goalEta({ contributions: [c(NOW, 3000)], savedMinor: 0, targetMinor: 6000, targetDate: null, now: NOW });
    expect(edge).toMatchObject({ kind: 'BY_PACE' });
  });

  it('fin de anio: la ventana abarca el anio anterior y el ETA cruza el anio', () => {
    const now = ms(2027, 1, 15);
    // Ventana: 2026-11-01 .. 2027-01-15.
    const contributions = [c(ms(2026, 10, 31, 23, 59), 9999), c(ms(2026, 11, 1, 0, 0), 300), c(ms(2026, 12, 31, 23, 59), 300), c(ms(2027, 1, 14), 300)];
    const eta = goalEta({ contributions, savedMinor: 10_000, targetMinor: 10_900, targetDate: null, now });
    // suma 900 -> 300/mes; faltan 900 -> 3 meses -> 2027-04-15
    expect(eta).toEqual({ kind: 'BY_PACE', date: '2027-04-15', monthsLeft: 3, monthlyAverageMinor: 300 });
  });

  it('la fecha estimada ajusta el dia al ultimo dia del mes destino', () => {
    const now = ms(2026, 1, 31);
    const eta = goalEta({ contributions: [c(ms(2026, 1, 30), 300)], savedMinor: 0, targetMinor: 100, targetDate: null, now });
    // 100/mes, falta 100 -> 1 mes -> 28 feb
    expect(eta).toMatchObject({ kind: 'BY_PACE', monthsLeft: 1, date: '2026-02-28' });
  });
});

describe('goalEta: tope de 100 anios del ETA por ritmo (F2b-ter)', () => {
  // 3000 en la ventana -> 1000 al mes: monthsLeft = ceil(3 * falta / 3000) = ceil(falta / 1000).
  const pace = (missing: number, contribution = 3000) =>
    goalEta({ contributions: [c(ms(2026, 10, 1), contribution)], savedMinor: 0, targetMinor: missing, targetDate: null, now: NOW });

  it('exactamente 1200 meses (100 anios) SE INCLUYE: decision confirmada, el tope es monthsLeft > 1200', () => {
    expect(pace(1_200_000)).toEqual({ kind: 'BY_PACE', date: '2126-10-05', monthsLeft: 1200, monthlyAverageMinor: 1000 });
  });

  it('1201 meses supera el tope: por calcular', () => {
    expect(pace(1_200_001)).toEqual({ kind: 'UNKNOWN' });
    expect(pace(1_201_000)).toEqual({ kind: 'UNKNOWN' });
  });

  it('falta enorme con aporte pequeno: por calcular, sin fecha de 6 digitos', () => {
    expect(goalEta({ contributions: [c(ms(2026, 10, 1), 300)], savedMinor: 0, targetMinor: 1e8, targetDate: null, now: NOW })).toEqual({ kind: 'UNKNOWN' });
  });

  it('falta de ~9e15 y aporte minimo (monthsLeft no es entero seguro): por calcular', () => {
    expect(goalEta({ contributions: [c(ms(2026, 10, 1), 1)], savedMinor: 0, targetMinor: 9e15, targetDate: null, now: NOW })).toEqual({ kind: 'UNKNOWN' });
    expect(goalEta({ contributions: [c(ms(2026, 10, 1), 1)], savedMinor: -Number.MAX_SAFE_INTEGER, targetMinor: Number.MAX_SAFE_INTEGER, targetDate: null, now: NOW })).toEqual({ kind: 'UNKNOWN' });
  });

  it('aporte minimo (1 en la ventana) con falta pequena: se calcula si cabe en el tope', () => {
    // total 1 -> 3 * falta meses: falta 400 -> 1200 (incluido); falta 401 -> 1203 (fuera).
    expect(goalEta({ contributions: [c(ms(2026, 10, 1), 1)], savedMinor: 0, targetMinor: 400, targetDate: null, now: NOW })).toMatchObject({ kind: 'BY_PACE', monthsLeft: 1200 });
    expect(goalEta({ contributions: [c(ms(2026, 10, 1), 1)], savedMinor: 0, targetMinor: 401, targetDate: null, now: NOW })).toEqual({ kind: 'UNKNOWN' });
  });

  it('cuando existe, la fecha del ETA siempre es una LocalDate de 4 digitos que parsea', () => {
    for (const missing of [1, 999, 1_000, 1_199_999, 1_200_000]) {
      const eta = pace(missing);
      expect(eta.kind).toBe('BY_PACE');
      if (eta.kind === 'BY_PACE') expect(() => parseLocalDate(eta.date)).not.toThrow();
    }
  });

  it('un now que haria pasar la fecha de 9999 tambien es por calcular', () => {
    const now = ms(9950, 1, 1);
    expect(goalEta({ contributions: [c(ms(9949, 12, 1), 3000)], savedMinor: 0, targetMinor: 1_200_000, targetDate: null, now })).toEqual({ kind: 'UNKNOWN' });
  });
});

describe('goalEta: BY_TARGET_DATE acotado y sin desbordes (F2b-ter)', () => {
  it('falta enorme: el aporte mensual nunca supera la falta y es entero seguro', () => {
    const eta = goalEta({ contributions: [], savedMinor: 0, targetMinor: 9e15, targetDate: '2027-10-05', now: NOW });
    expect(eta).toMatchObject({ kind: 'BY_TARGET_DATE', monthsLeft: 12, requiredMonthlyMinor: 7.5e14 });
    if (eta.kind === 'BY_TARGET_DATE') expect(Number.isSafeInteger(eta.requiredMonthlyMinor)).toBe(true);
  });

  it('fecha objetivo lejana (9999-12-31) termina y es coherente', () => {
    const eta = goalEta({ contributions: [], savedMinor: 0, targetMinor: 1_000_000, targetDate: '9999-12-31', now: NOW });
    expect(eta).toMatchObject({ kind: 'BY_TARGET_DATE', overdue: false, monthsLeft: (9999 - 2026) * 12 + 3 });
  });

  it('el calculo O(1) de monthsLeft coincide con la definicion (menor k >= 1 con hoy + k meses >= fecha)', () => {
    const reference = (today: string, target: string): number => {
      const p = parseLocalDate(today);
      let k = 1;
      for (;;) {
        const ym = addMonthsToYearMonth(p.year, p.month, k);
        const day = Math.min(p.day, daysInMonth(ym.year, ym.month));
        if (formatLocalDate(ym.year, ym.month, day) >= target) return k;
        k++;
      }
    };
    const nows = [ms(2026, 1, 31), ms(2026, 3, 31), ms(2024, 2, 29), ms(2026, 10, 5), ms(2026, 12, 31)];
    for (const now of nows) {
      const today = toLocalDate(now);
      for (let offset = 0; offset <= 800; offset += 1) {
        const target = addDays(today, offset);
        const eta = goalEta({ contributions: [], savedMinor: 0, targetMinor: 1000, targetDate: target, now });
        expect(eta, `${today} -> ${target}`).toMatchObject({ monthsLeft: reference(today, target) });
      }
    }
  });

  it('un targetDate con formato invalido (anio de 5 digitos) no cuelga el calculo: por calcular', () => {
    expect(goalEta({ contributions: [], savedMinor: 0, targetMinor: 1000, targetDate: '99999-01-01', now: NOW })).toEqual({ kind: 'UNKNOWN' });
  });
});

describe('goalEta: pureza', () => {
  it('no muta los aportes ni depende del orden', () => {
    const contributions = [c(ms(2026, 10, 1), 100), c(ms(2026, 8, 5), 200)];
    const copy = contributions.map((x) => ({ ...x }));
    const a = goalEta({ contributions, savedMinor: 300, targetMinor: 900, targetDate: null, now: NOW });
    const b = goalEta({ contributions: [...contributions].reverse(), savedMinor: 300, targetMinor: 900, targetDate: null, now: NOW });
    expect(a).toEqual(b);
    expect(contributions).toEqual(copy);
  });
});
