/**
 * ThemeProvider y useTheme ÚNICOS de la app.
 *
 * - `preference` ('light' | 'dark' | 'system', por defecto 'system') entra por prop. Un contexto
 *   mínimo (`useThemeController`) permite cambiarla; la integración con el almacén de ajustes de
 *   usuario la hace la fase de navegación pasando `preference` desde el store (src/store/**).
 * - scheme = resolveScheme(preference, useColorScheme()).
 * - Alimenta el tema de React Navigation (ThemeProvider de expo-router) y la barra de estado.
 * - Con preferencia explícita fuerza el esquema nativo con `Appearance.setColorScheme` (así
 *   teclado, alertas y controles nativos coinciden); con 'system' lo devuelve a 'unspecified'
 *   (sigue al sistema). Requiere `userInterfaceStyle: "automatic"` en app.json (ya está).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { createNavigationTheme } from './navigationTheme';
import { getTheme, type Theme } from './theme';
import { resolveScheme, type ThemePreference } from './tokens';

const ThemeContext = createContext<Theme | null>(null);

interface ThemeController {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeControllerContext = createContext<ThemeController | null>(null);

interface ThemeProviderProps {
  /** Preferencia del usuario. Por defecto 'system'. Si cambia la prop, reemplaza a la local. */
  preference?: ThemePreference;
  children: ReactNode;
}

export function ThemeProvider({ preference: preferenceProp = 'system', children }: ThemeProviderProps) {
  const [preference, setPreference] = useState<ThemePreference>(preferenceProp);

  // Sincroniza cuando la prop cambia (patrón "ajustar estado al cambiar una prop", sin efecto).
  const [lastProp, setLastProp] = useState<ThemePreference>(preferenceProp);
  if (lastProp !== preferenceProp) {
    setLastProp(preferenceProp);
    setPreference(preferenceProp);
  }

  const systemScheme = useColorScheme();
  const scheme = resolveScheme(preference, systemScheme);

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const theme = getTheme(scheme);
  const navigationTheme = useMemo(() => createNavigationTheme(scheme, theme.colors), [scheme, theme.colors]);
  const controller = useMemo<ThemeController>(() => ({ preference, setPreference }), [preference]);

  return (
    <ThemeControllerContext.Provider value={controller}>
      <ThemeContext.Provider value={theme}>
        <NavigationThemeProvider value={navigationTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {children}
        </NavigationThemeProvider>
      </ThemeContext.Provider>
    </ThemeControllerContext.Provider>
  );
}

/** Tema efectivo: `{ scheme, colors, type, space, radius, shadowSheet }`. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme debe usarse dentro de <ThemeProvider> (app/_layout.tsx).');
  return theme;
}

/** Preferencia actual y su setter (para la pantalla de Ajustes). */
export function useThemeController(): ThemeController {
  const controller = useContext(ThemeControllerContext);
  if (!controller) throw new Error('useThemeController debe usarse dentro de <ThemeProvider>.');
  return controller;
}
