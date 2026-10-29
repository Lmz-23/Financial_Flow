// =============================================================================
// THEME BARREL
// =============================================================================

// Sistema de tema vigente: UN solo ThemeProvider y UN solo useTheme.
export { ThemeProvider, useTheme, useThemeController } from './ThemeProvider';
export type { Theme, ResolvedTypeStyle } from './theme';
export { getTheme, inkFor } from './theme';
export {
  resolveScheme,
  colorTokens,
  typeSpecs,
  space,
  radius,
  cssShadowToRN,
} from './tokens';
export type {
  Scheme,
  ThemePreference,
  SystemScheme,
  ColorTokens,
  ColorTokenName,
  TypeStyleName,
  SpaceStep,
  RadiusName,
  ShadowStyle,
} from './tokens';
export { fontFamilies, fontFamilyFor } from './fontFamilies';

// -----------------------------------------------------------------------------
// SHIM TEMPORAL: exportaciones antiguas que usan las pantallas existentes
// (`colors`, `spacing`, `typography`, `shadows`). Se borran cuando las pantallas se rehagan
// con `useTheme()`. El `useTheme`/`ThemeContext` viejo (siempre oscuro) se eliminó: no tenía
// ningún consumidor real.
// -----------------------------------------------------------------------------
export { colors } from './colors';
export type { Colors, ColorKey } from './colors';

export { spacing } from './spacing';
export type { Spacing, SpacingKey } from './spacing';

export { typography } from './typography';
export type { Typography } from './typography';

export { shadows } from './shadows';
export type { Shadows, ShadowKey } from './shadows';
