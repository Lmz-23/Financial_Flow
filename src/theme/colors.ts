/**
 * SHIM TEMPORAL DE COMPATIBILIDAD. Se borra cuando las pantallas se rehagan con `useTheme()`.
 *
 * Las pantallas antiguas importan este `colors` estático con los nombres de la paleta vieja.
 * Aquí esos nombres apuntan a la paleta NUEVA del Design System, versión CLARA y ESTÁTICA, así
 * que las pantallas viejas cambian de aspecto sin tocarlas, pero NO siguen el modo oscuro.
 *
 * Código nuevo: usar `useTheme().colors` (src/theme/ThemeProvider.tsx), nunca este objeto.
 * La regla de ESLint `no-restricted-imports` (eslint.config.js) avisa de cada import pendiente.
 *
 * Mapeo (decidido en la arquitectura, §5):
 *   bg -> surfacePage, surface1 -> surfaceCard, surface2 -> surfaceRaised, border -> borderSubtle,
 *   textPrimary -> inkPrimary, textMuted -> inkSecondary, accentGreen -> signalGrowth,
 *   accentRed -> signalDebt, accentBlue -> brandPrimary, accentAmber -> signalGoal,
 *   accentPurple -> brandPrimary, accentYellow -> signalGoal (no existía y daba `undefined`;
 *   NO es un token del Design System).
 * Elegidos por el shim (sin mapeo previo): surface3 -> surfaceRaised, borderLight -> borderSubtle,
 *   textHint -> inkSecondary, surface -> surfaceCard (alias que algunas pantallas usan y tampoco
 *   existía).
 */
import { colorTokens } from './tokens';

const light = colorTokens.light;

export const colors = {
  // Backgrounds
  bg: light.surfacePage,
  surface: light.surfaceCard,
  surface1: light.surfaceCard,
  surface2: light.surfaceRaised,
  surface3: light.surfaceRaised,

  // Borders
  border: light.borderSubtle,
  borderLight: light.borderSubtle,

  // Text
  textPrimary: light.inkPrimary,
  textMuted: light.inkSecondary,
  textHint: light.inkSecondary,

  // Accents
  accentGreen: light.signalGrowth,
  accentBlue: light.brandPrimary,
  accentRed: light.signalDebt,
  accentAmber: light.signalGoal,
  accentYellow: light.signalGoal,
  accentPurple: light.brandPrimary,
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;
