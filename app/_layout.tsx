import { useEffect, useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { initializeApp, subscribeToForeground } from '../src/app-services';
import { useSettingsStore, useThemePreference } from '../src/store/useSettingsStore';
import { ThemeProvider, useTheme } from '../src/theme';
import { fontAssets } from '../src/theme/fontAssets';

// Retiene la pantalla de inicio hasta que las fuentes IBM Plex estén cargadas.
SplashScreen.preventAutoHideAsync();

/** ThemeProvider alimentado por la preferencia guardada en los ajustes (cache de SQLite). */
function SettingsThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemePreference();
  return <ThemeProvider preference={preference}>{children}</ThemeProvider>;
}

/** Migraciones, semilla y carga de ajustes. No renderiza rutas hasta que todo está listo. */
function Initializer({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await initializeApp();
        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize database:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    }
    init();
  }, []);

  // Al volver a primer plano se invalida todo (mes en curso, "Hoy", estado de próximos pagos).
  useEffect(() => (isReady ? subscribeToForeground() : undefined), [isReady]);

  if (error || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfacePage }}>
        <ActivityIndicator size="large" color={error ? colors.signalDebt : colors.brandPrimary} />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Stack raíz sin tabs. `Stack.Protected` deja `(app)` accesible solo con el onboarding completo y
 * `onboarding` solo mientras falta (si el guard cambia, el router redirige solo).
 */
function RootNavigator() {
  const onboardingDone = useSettingsStore((s) => s.settings?.onboardingDone ?? false);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboardingDone}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!onboardingDone}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Registra IBMPlexSans_* / IBMPlexMono_* con el mismo nombre en iOS y Android (ver src/theme/fontAssets.ts).
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const fontsSettled = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) console.error('Failed to load fonts:', fontError);
    if (fontsSettled) SplashScreen.hideAsync();
  }, [fontsSettled, fontError]);

  // Si una fuente falla, se continúa con la fuente del sistema en vez de dejar la app bloqueada.
  if (!fontsSettled) return null;

  return (
    <SettingsThemeProvider>
      <SafeAreaProvider>
        <Initializer>
          <RootNavigator />
        </Initializer>
      </SafeAreaProvider>
    </SettingsThemeProvider>
  );
}
