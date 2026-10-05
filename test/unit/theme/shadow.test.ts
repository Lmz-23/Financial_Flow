import { describe, expect, it } from 'vitest';

import { getTheme } from '../../../src/theme/theme';
import { cssShadowToRN, rawShadowSheet, shadowSheetTokens } from '../../../src/theme/tokens';

describe('traducción de sombra CSS a boxShadow de React Native', () => {
  it('shadow-sheet claro: 0 -8px 24px rgba(14,33,28,0.14)', () => {
    expect(cssShadowToRN('0 -8px 24px rgba(14,33,28,0.14)')).toEqual({
      boxShadow: [{ offsetX: 0, offsetY: -8, blurRadius: 24, spreadDistance: 0, color: 'rgba(14,33,28,0.14)' }],
    });
  });

  it('el valor del token se traduce sin alterar offset, blur ni color', () => {
    expect(rawShadowSheet.light).toBe('0 -8px 24px rgba(14,33,28,0.14)');
    expect(shadowSheetTokens.light.boxShadow?.[0].offsetY).toBe(-8);
    expect(shadowSheetTokens.light.boxShadow?.[0].blurRadius).toBe(24);
  });

  it("'none' (oscuro) produce un estilo vacío", () => {
    expect(cssShadowToRN('none')).toEqual({});
    expect(shadowSheetTokens.dark).toEqual({});
    expect(getTheme('dark').shadowSheet).toEqual({});
    expect(getTheme('light').shadowSheet.boxShadow).toHaveLength(1);
  });

  it('acepta spread opcional y valores sin unidad', () => {
    expect(cssShadowToRN('2px 4px 8px 1px #000000').boxShadow?.[0]).toEqual({
      offsetX: 2,
      offsetY: 4,
      blurRadius: 8,
      spreadDistance: 1,
      color: '#000000',
    });
    expect(cssShadowToRN('0 0 0 #000').boxShadow?.[0].blurRadius).toBe(0);
  });

  it('rechaza sombras que no sabe traducir', () => {
    expect(() => cssShadowToRN('inset 0 1px red')).toThrow();
    expect(() => cssShadowToRN('1px')).toThrow();
  });
});
