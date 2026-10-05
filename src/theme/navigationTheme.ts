/**
 * Tema de React Navigation / expo-router derivado de los tokens.
 * Archivo PURO: solo tipos, sin imports de runtime (el tipo se declara localmente con la misma
 * forma que `Theme` de expo-router, ver node_modules/expo-router/build/react-navigation/native/types.d.ts).
 */
import { fontFamilies } from './fontFamilies';
import type { ColorTokens, Scheme } from './tokens';

interface NavFontStyle {
  fontFamily: string;
  fontWeight: 'normal';
}

export interface NavigationTheme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
  fonts: {
    regular: NavFontStyle;
    medium: NavFontStyle;
    bold: NavFontStyle;
    heavy: NavFontStyle;
  };
}

/**
 * - primary: brand-primary (navegación activa), background: surface-page, card: surface-card,
 *   text: ink-primary, border: border-subtle, notification: signal-debt (insignias de aviso).
 * - fonts: el peso va en la familia (IBM Plex), por eso fontWeight es siempre 'normal'. Evita que
 *   Android sintetice un negrita sobre una fuente que ya es SemiBold. No hay peso 700: `heavy`
 *   usa SemiBold (600), el más pesado cargado.
 */
export function createNavigationTheme(scheme: Scheme, colors: ColorTokens): NavigationTheme {
  return {
    dark: scheme === 'dark',
    colors: {
      primary: colors.brandPrimary,
      background: colors.surfacePage,
      card: colors.surfaceCard,
      text: colors.inkPrimary,
      border: colors.borderSubtle,
      notification: colors.signalDebt,
    },
    fonts: {
      regular: { fontFamily: fontFamilies.sans[400], fontWeight: 'normal' },
      medium: { fontFamily: fontFamilies.sans[500], fontWeight: 'normal' },
      bold: { fontFamily: fontFamilies.sans[600], fontWeight: 'normal' },
      heavy: { fontFamily: fontFamilies.sans[600], fontWeight: 'normal' },
    },
  };
}
