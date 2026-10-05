import { describe, expect, it } from 'vitest';

import { toneColor } from '../../../src/components/ui/ds/tone';
import {
  amountDisplay,
  clampPercent,
  digitsOnly,
  formatCurrency,
  formatDigitsAsCurrency,
  groupThousands,
} from '../../../src/components/ui/ds/utils';
import { inkFor } from '../../../src/theme/theme';
import { colorTokens } from '../../../src/theme/tokens';

describe('formato de montos', () => {
  it('agrupa miles con punto como el diseño', () => {
    expect(groupThousands(450000)).toBe('450.000');
    expect(groupThousands(999)).toBe('999');
    expect(groupThousands(1200000)).toBe('1.200.000');
    expect(formatCurrency(85000)).toBe('$85.000');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('signo y tono', () => {
    expect(amountDisplay(160000, { tone: 'auto' })).toEqual({ text: '+$160.000', tone: 'growth' });
    expect(amountDisplay(-85000, { tone: 'auto' })).toEqual({ text: '-$85.000', tone: 'debt' });
    expect(amountDisplay(0, { tone: 'auto' })).toEqual({ text: '$0', tone: 'neutral' });
    expect(amountDisplay(340000)).toEqual({ text: '$340.000', tone: 'neutral' });
    expect(amountDisplay(340000, { showSign: true }).text).toBe('+$340.000');
    expect(amountDisplay(-5, { tone: 'neutral' }).text).toBe('-$5');
    expect(amountDisplay(1000, { tone: 'goal' }).tone).toBe('goal');
    expect(amountDisplay(-0.4, { tone: 'auto' })).toEqual({ text: '$0', tone: 'neutral' });
  });

  it('formateador personalizado', () => {
    expect(amountDisplay(-1, { format: (n) => `COP ${n}` }).text).toBe('-COP 1');
  });
});

describe('MoneyInput helpers', () => {
  it('digitsOnly y formatDigitsAsCurrency', () => {
    expect(digitsOnly('$1.200.000')).toBe('1200000');
    expect(digitsOnly('abc')).toBe('');
    expect(formatDigitsAsCurrency('1200000')).toBe('$1.200.000');
    expect(formatDigitsAsCurrency('')).toBe('');
    expect(formatDigitsAsCurrency('000')).toBe('$0');
    expect(formatDigitsAsCurrency('0042')).toBe('$42');
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
