import { createContext, useContext } from 'react';

export { colors } from './colors';
export type { Colors, ColorKey } from './colors';

export { spacing } from './spacing';
export type { Spacing, SpacingKey } from './spacing';

export { typography } from './typography';
export type { Typography } from './typography';

export { shadows } from './shadows';
export type { Shadows, ShadowKey } from './shadows';

// Theme types
export type ThemeMode = 'dark' | 'light';

export interface Theme {
  mode: ThemeMode;
  colors: typeof import('./colors').colors;
  spacing: typeof import('./spacing').spacing;
  typography: typeof import('./typography').typography;
  shadows: typeof import('./shadows').shadows;
}

// Theme context - prepared for future light mode support
export const ThemeContext = createContext<Theme | null>(null);

// Dark theme (default)
const darkTheme: Theme = {
  mode: 'dark',
  colors: require('./colors').colors,
  spacing: require('./spacing').spacing,
  typography: require('./typography').typography,
  shadows: require('./shadows').shadows,
};

// Hook para acceder al theme
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  // Por ahora siempre retorna dark theme
  // Cuando se implemente light mode, el Provider vendrá de app/_layout.tsx
  return context ?? darkTheme;
}
