import { describe, expect, it } from 'vitest';

import { colors } from '../../../src/theme/colors';
import { colorTokens } from '../../../src/theme/tokens';

/** Claves del `colors` ANTIGUO (src/theme/colors.ts en HEAD) que las pantallas siguen importando. */
const OLD_KEYS = [
  'bg',
  'surface1',
  'surface2',
  'surface3',
  'border',
  'borderLight',
  'textPrimary',
  'textMuted',
  'textHint',
  'accentGreen',
  'accentBlue',
  'accentRed',
  'accentAmber',
  'accentPurple',
] as const;

describe('shim colors.ts', () => {
  it('conserva todas las claves viejas', () => {
    for (const key of OLD_KEYS) expect(colors, key).toHaveProperty(key);
  });

  it('ningún valor es undefined y todos son hex válidos', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(value, key).toBeDefined();
      expect(value, key).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('accentYellow (usado en ~25 sitios y antes undefined) y surface (alias usado en 4) existen', () => {
    expect(colors.accentYellow).toBe(colorTokens.light.signalGoal);
    expect(colors.surface).toBe(colorTokens.light.surfaceCard);
  });

  it('apunta a la paleta nueva CLARA según el mapeo aprobado', () => {
    const l = colorTokens.light;
    expect(colors.bg).toBe(l.surfacePage);
    expect(colors.surface1).toBe(l.surfaceCard);
    expect(colors.surface2).toBe(l.surfaceRaised);
    expect(colors.border).toBe(l.borderSubtle);
    expect(colors.textPrimary).toBe(l.inkPrimary);
    expect(colors.textMuted).toBe(l.inkSecondary);
    expect(colors.accentGreen).toBe(l.signalGrowth);
    expect(colors.accentRed).toBe(l.signalDebt);
    expect(colors.accentBlue).toBe(l.brandPrimary);
    expect(colors.accentAmber).toBe(l.signalGoal);
    expect(colors.accentPurple).toBe(l.brandPrimary);
  });

  it('ya no contiene valores de la paleta antigua', () => {
    const old = ['#0a0a0f', '#13131a', '#1c1c26', '#f0eff8', '#2dd4a0', '#4d9cf8', '#f26b6b', '#f5b942', '#a78bfa'];
    const values = Object.values(colors).map((v) => v.toLowerCase());
    for (const o of old) expect(values).not.toContain(o);
  });
});
