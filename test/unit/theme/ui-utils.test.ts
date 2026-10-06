import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { toneColor } from '../../../src/components/ui/ds/tone';
import {
  amountDisplay,
  clampPercent,
  digitsOnly,
  inputTextFromMinor,
  minorFromInputText,
} from '../../../src/components/ui/ds/utils';
import { formatCOP, toMinor } from '../../../src/domain/money';
import { inkFor } from '../../../src/theme/theme';
import { colorTokens } from '../../../src/theme/tokens';

// Los montos de las primitivas son unidades menores; el texto lo produce formatCOP (dominio).
describe('amountDisplay (unidades menores, delega en formatCOP)', () => {
  it('el texto es formatCOP del monto', () => {
    expect(amountDisplay(toMinor(340000)).text).toBe(formatCOP(toMinor(340000)));
    expect(amountDisplay(toMinor(-85000)).text).toBe(formatCOP(toMinor(-85000)));
    expect(amountDisplay(0).text).toBe(formatCOP(0));
  });

  it('signo y tono', () => {
    const plus = amountDisplay(toMinor(160000), { tone: 'auto' });
    expect(plus).toEqual({ text: `+${formatCOP(toMinor(160000))}`, tone: 'growth' });
    const minus = amountDisplay(toMinor(-85000), { tone: 'auto' });
    expect(minus).toEqual({ text: formatCOP(toMinor(-85000)), tone: 'debt' });
    expect(minus.text.startsWith('-')).toBe(true);
    expect(amountDisplay(0, { tone: 'auto' })).toEqual({ text: formatCOP(0), tone: 'neutral' });
    expect(amountDisplay(toMinor(340000), { showSign: true }).text).toBe(`+${formatCOP(toMinor(340000))}`);
    expect(amountDisplay(toMinor(340000)).text.startsWith('+')).toBe(false);
    expect(amountDisplay(toMinor(1000), { tone: 'goal' }).tone).toBe('goal');
  });

  it('un monto que se muestra como 0 pesos no lleva signo y es neutral', () => {
    expect(amountDisplay(-40, { tone: 'auto' })).toEqual({ text: formatCOP(0), tone: 'neutral' });
    expect(amountDisplay(40, { tone: 'auto' })).toEqual({ text: formatCOP(0), tone: 'neutral' });
  });
});

describe('MoneyInput helpers (unidades menores in/out)', () => {
  it('digitsOnly', () => {
    expect(digitsOnly('$1.200.000')).toBe('1200000');
    expect(digitsOnly('abc')).toBe('');
  });

  it('minorFromInputText: dígitos escritos son pesos enteros -> unidades menores', () => {
    expect(minorFromInputText('1200000')).toBe(toMinor(1200000));
    expect(minorFromInputText(formatCOP(toMinor(1200000)))).toBe(toMinor(1200000));
    expect(minorFromInputText('0042')).toBe(toMinor(42));
    expect(minorFromInputText('0')).toBe(0);
  });

  it('minorFromInputText: vacío, sin dígitos o fuera de rango -> null', () => {
    expect(minorFromInputText('')).toBeNull();
    expect(minorFromInputText('$ ')).toBeNull();
    expect(minorFromInputText('9'.repeat(30))).toBeNull();
  });

  it('inputTextFromMinor delega en formatCOP; null -> vacío', () => {
    expect(inputTextFromMinor(null)).toBe('');
    expect(inputTextFromMinor(toMinor(1200000))).toBe(formatCOP(toMinor(1200000)));
    expect(inputTextFromMinor(0)).toBe(formatCOP(0));
  });

  it('ida y vuelta: texto -> minor -> texto estable', () => {
    const minor = minorFromInputText('1234567');
    expect(minor).toBe(toMinor(1234567));
    expect(minorFromInputText(inputTextFromMinor(minor))).toBe(minor);
  });
});

describe('ds/ no formatea pesos por su cuenta', () => {
  const dir = join(__dirname, '../../../src/components/ui/ds');
  const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f));
  /** Excepciones justificadas por archivo (vacía: no hay ninguna). */
  const EXCEPTIONS: Record<string, string[]> = {};
  const FORBIDDEN: [string, RegExp][] = [
    ['toLocaleString', /toLocaleString/],
    ['Intl.NumberFormat', /Intl\.NumberFormat/],
    ['toFixed', /\.toFixed\(/],
    ['formatCurrency', /formatCurrency/],
    ['groupThousands', /groupThousands/],
    ['plantilla con $ literal seguido de interpolación', /`[^`]*\$\$\{/],
    ["'$' concatenado", /['"]\$['"]\s*\+/],
  ];

  it('hay archivos que revisar', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`ningún archivo contiene ${label}`, () => {
      const offenders = files.filter(
        (f) => !(EXCEPTIONS[f] ?? []).includes(label) && pattern.test(readFileSync(join(dir, f), 'utf8')),
      );
      expect(offenders).toEqual([]);
    });
  }

  it('las primitivas con montos importan formatCOP del dominio', () => {
    for (const f of ['AccountPicker.tsx', 'MoneyInput.tsx', 'utils.ts']) {
      expect(readFileSync(join(dir, f), 'utf8')).toMatch(/formatCOP/);
    }
  });
});

describe('ProgressBar clampPercent', () => {
  it('limita a [0, 100]', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(NaN)).toBe(0);
    expect(clampPercent(Infinity)).toBe(0);
  });
});

describe('regla ink-secondary solo para texto de 14 px o más', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const c = colorTokens[scheme];
    it(`${scheme}: secondary se respeta a 14 px o más y se degrada debajo`, () => {
      expect(inkFor(c, 14, 'secondary')).toBe(c.inkSecondary);
      expect(inkFor(c, 18, 'secondary')).toBe(c.inkSecondary);
      expect(inkFor(c, 13, 'secondary')).toBe(c.inkPrimary);
      expect(inkFor(c, 12, 'secondary')).toBe(c.inkPrimary);
      expect(inkFor(c, 12, 'primary')).toBe(c.inkPrimary);
      expect(toneColor(c, 'secondary', 13)).toBe(c.inkPrimary);
      expect(toneColor(c, 'secondary', 15)).toBe(c.inkSecondary);
    });
  }

  it('los tonos de señal y marca mapean a sus tokens', () => {
    const c = colorTokens.light;
    expect(toneColor(c, 'growth', 14)).toBe(c.signalGrowth);
    expect(toneColor(c, 'debt', 14)).toBe(c.signalDebt);
    expect(toneColor(c, 'goal', 14)).toBe(c.signalGoal);
    expect(toneColor(c, 'brand', 14)).toBe(c.brandPrimary);
    expect(toneColor(c, 'onBrand', 14)).toBe(c.inkOnBrand);
  });
});
