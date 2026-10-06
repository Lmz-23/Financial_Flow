import { describe, expect, it } from 'vitest';
import {
  addMinor,
  formatCOP,
  formatRate,
  fromMinor,
  parseMinor,
  parsePesos,
  parseRatePercent,
  roundMinor,
  toMinor,
} from '../../../src/domain/money';

describe('money: conversión y redondeo', () => {
  it('convierte pesos a unidades menores y de vuelta', () => {
    expect(toMinor(1234)).toBe(123400);
    expect(fromMinor(123400)).toBe(1234);
    expect(toMinor(0)).toBe(0);
  });

  it('estabiliza errores de coma flotante', () => {
    expect(toMinor(1.005)).toBe(101);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it('redondea half-away-from-zero y no devuelve -0', () => {
    expect(roundMinor(2.5)).toBe(3);
    expect(roundMinor(-2.5)).toBe(-3);
    expect(Object.is(roundMinor(-0.2), 0)).toBe(true);
  });

  it('rechaza valores no finitos', () => {
    expect(() => toMinor(Number.NaN)).toThrow(RangeError);
    expect(() => roundMinor(Infinity)).toThrow(RangeError);
  });

  it('suma segura: valida enteros y desbordes', () => {
    expect(addMinor(100, 250, -50)).toBe(300);
    expect(addMinor()).toBe(0);
    expect(() => addMinor(1.5)).toThrow(RangeError);
    expect(() => addMinor(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});

describe('money: formatCOP', () => {
  it.each([
    [0, '$0'],
    [100, '$1'],
    [99900, '$999'],
    [100000, '$1.000'],
    [123456700, '$1.234.567'],
    [100000000000, '$1.000.000.000'],
    [-5000000, '-$50.000'],
    [149, '$1'],
    [150, '$2'],
  ])('formatCOP(%i) = %s', (minor, expected) => {
    expect(formatCOP(minor)).toBe(expected);
  });

  it('no muestra "-$0" para negativos que redondean a 0', () => {
    expect(formatCOP(-40)).toBe('$0');
  });

  it('cero y -0 dan "$0"', () => {
    expect(formatCOP(0)).toBe('$0');
    expect(formatCOP(-0)).toBe('$0');
  });

  it('50 centavos redondea al peso hacia arriba, también en negativo', () => {
    expect(formatCOP(50)).toBe('$1');
    expect(formatCOP(-50)).toBe('-$1');
    expect(formatCOP(49)).toBe('$0');
  });

  it('negativos: signo antes del "$"', () => {
    expect(formatCOP(-100)).toBe('-$1');
    expect(formatCOP(-123456700)).toBe('-$1.234.567');
  });

  it('rangos grandes dentro del rango seguro', () => {
    expect(formatCOP(100000000000000)).toBe('$1.000.000.000.000');
    expect(formatCOP(Number.MAX_SAFE_INTEGER)).toBe('$90.071.992.547.410');
    expect(formatCOP(-Number.MAX_SAFE_INTEGER)).toBe('-$90.071.992.547.410');
  });

  it('ninguna salida contiene espacios', () => {
    for (const m of [0, 1, 50, 99900, 123456700, -5000000, -40, 100000000000, Number.MAX_SAFE_INTEGER]) {
      expect(formatCOP(m)).not.toMatch(/\s/);
      expect(formatCOP(m)).toMatch(/^-?\$\d{1,3}(\.\d{3})*$/);
    }
  });

  it('ida y vuelta con parsePesos (salvo signo y redondeo)', () => {
    for (const pesos of [0, 1, 999, 1000, 1234567, 50000, 1000000000]) {
      expect(parsePesos(formatCOP(pesos * 100))).toBe(pesos);
    }
    // parsePesos no admite negativos: el formato negativo no hace ida y vuelta.
    expect(parsePesos(formatCOP(-5000000))).toBeNull();
  });

  it('rechaza no enteros', () => {
    expect(() => formatCOP(10.5)).toThrow(RangeError);
  });
});

describe('money: parseo tolerante', () => {
  it.each([
    ['1.200.000', 1200000],
    ['1200000', 1200000],
    ['$ 1.200.000', 1200000],
    ['1.200.000,50', 1200000.5],
    ['0,5', 0.5],
    ['  35.000 ', 35000],
    ['999', 999],
  ])('parsePesos(%j) = %d', (text, expected) => {
    expect(parsePesos(text)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.20', '1..000', '1,2,3', '12.34.567', '$'])(
    'parsePesos(%j) = null',
    (text) => {
      expect(parsePesos(text)).toBeNull();
    },
  );

  it('parsePesos acepta "$" con y sin espacio', () => {
    expect(parsePesos('$1.200.000')).toBe(1200000);
    expect(parsePesos('$ 1.200.000')).toBe(1200000);
  });

  it('parseMinor devuelve unidades menores', () => {
    expect(parseMinor('1.200.000')).toBe(120000000);
    expect(parseMinor('10,25')).toBe(1025);
    expect(parseMinor('x')).toBeNull();
  });

  it('parseRatePercent acepta coma o punto decimal', () => {
    expect(parseRatePercent('2,3')).toBe(2.3);
    expect(parseRatePercent('2.3')).toBe(2.3);
    expect(parseRatePercent('2,3 %')).toBe(2.3);
    expect(parseRatePercent('0')).toBe(0);
    expect(parseRatePercent('')).toBeNull();
    expect(parseRatePercent('-1')).toBeNull();
    expect(parseRatePercent('1,2,3')).toBeNull();
  });

  it('formatRate usa coma decimal y recorta ceros', () => {
    expect(formatRate(0.023)).toBe('2,3%');
    expect(formatRate(0.02)).toBe('2%');
    expect(formatRate(0.08144165)).toBe('8,14%');
    expect(formatRate(0.08144165, 1)).toBe('8,1%');
  });
});
