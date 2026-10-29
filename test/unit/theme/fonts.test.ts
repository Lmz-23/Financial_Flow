import { describe, expect, it } from 'vitest';

import { allFontFamilyNames, fontFamilies, fontFamilyFor } from '../../../src/theme/fontFamilies';
import { createNavigationTheme } from '../../../src/theme/navigationTheme';
import { getTheme } from '../../../src/theme/theme';
import { colorTokens, typeSpecs, type TypeStyleName } from '../../../src/theme/tokens';

describe('mapa de fuentes (peso -> familia)', () => {
  it('nombres deterministas de los paquetes @expo-google-fonts', () => {
    expect(fontFamilies.sans[400]).toBe('IBMPlexSans_400Regular');
    expect(fontFamilies.sans[500]).toBe('IBMPlexSans_500Medium');
    expect(fontFamilies.sans[600]).toBe('IBMPlexSans_600SemiBold');
    expect(fontFamilies.mono[400]).toBe('IBMPlexMono_400Regular');
    expect(fontFamilies.mono[500]).toBe('IBMPlexMono_500Medium');
    expect(allFontFamilyNames).toHaveLength(5);
  });

  it('mono no existe en peso 600', () => {
    expect(() => fontFamilyFor('mono', 600)).toThrow();
  });

  it('cada estilo de texto resuelve a una familia cargada y la mono solo en montos', () => {
    const theme = getTheme('light');
    for (const name of Object.keys(typeSpecs) as TypeStyleName[]) {
      const family = theme.type[name].fontFamily;
      expect(allFontFamilyNames, name).toContain(family);
      expect(family.startsWith('IBMPlexMono'), name).toBe(name.startsWith('amount'));
    }
    expect(theme.type.h1.fontFamily).toBe('IBMPlexSans_600SemiBold');
    expect(theme.type.body.fontFamily).toBe('IBMPlexSans_400Regular');
    expect(theme.type.label.fontFamily).toBe('IBMPlexSans_500Medium');
    expect(theme.type.amountLg.fontFamily).toBe('IBMPlexMono_500Medium');
    expect(theme.type.amountSm.fontFamily).toBe('IBMPlexMono_400Regular');
  });
});

describe('tema de navegación', () => {
  it('claro: dark=false y colores de los tokens', () => {
    const nav = createNavigationTheme('light', colorTokens.light);
    expect(nav.dark).toBe(false);
    expect(nav.colors).toEqual({
      primary: '#0B3B36',
      background: '#F3F6F4',
      card: '#FFFFFF',
      text: '#0E211C',
      border: '#D7E0DB',
      notification: '#B5472E',
    });
  });

  it('oscuro: dark=true y colores oscuros', () => {
    const nav = createNavigationTheme('dark', colorTokens.dark);
    expect(nav.dark).toBe(true);
    expect(nav.colors.background).toBe('#0B1512');
    expect(nav.colors.primary).toBe('#4FC9A8');
  });

  it('las fuentes de navegación usan IBM Plex y fontWeight normal', () => {
    const nav = createNavigationTheme('light', colorTokens.light);
    for (const f of Object.values(nav.fonts)) {
      expect(allFontFamilyNames).toContain(f.fontFamily);
      expect(f.fontWeight).toBe('normal');
    }
  });
});
