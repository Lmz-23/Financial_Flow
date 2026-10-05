import { describe, expect, it } from 'vitest';

import { getTheme } from '../../../src/theme/theme';
import { resolveScheme } from '../../../src/theme/tokens';

describe('resolveScheme: esquema efectivo', () => {
  it("'light' y 'dark' mandan sobre el sistema", () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', null)).toBe('light');
    expect(resolveScheme('dark', undefined)).toBe('dark');
  });

  it("'system' sigue al sistema", () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  it("'system' sin información del sistema cae a claro", () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
    expect(resolveScheme('system', 'unspecified')).toBe('light');
  });
});

describe('getTheme', () => {
  it('devuelve la forma { scheme, colors, type, space, radius, shadowSheet }', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const theme = getTheme(scheme);
      expect(Object.keys(theme).sort()).toEqual(['colors', 'radius', 'scheme', 'shadowSheet', 'space', 'type']);
      expect(theme.scheme).toBe(scheme);
    }
  });

  it('claro y oscuro tienen paletas distintas y referencia estable', () => {
    expect(getTheme('light').colors.surfacePage).toBe('#F3F6F4');
    expect(getTheme('dark').colors.surfacePage).toBe('#0B1512');
    expect(getTheme('dark')).toBe(getTheme('dark'));
  });

  it('el estilo de texto no incluye fontWeight (el peso va en la familia)', () => {
    for (const style of Object.values(getTheme('light').type)) {
      expect(Object.keys(style).sort()).toEqual(['fontFamily', 'fontSize', 'lineHeight']);
    }
  });
});
