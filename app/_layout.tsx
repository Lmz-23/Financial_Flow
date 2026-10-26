import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { router, Stack, type Href } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { ErrorScreen } from '../src/components/feedback/ErrorScreen';
import { nextFailureCount, safeErrorLogArgs } from '../src/lib/errorScreen';
import { initializeApp, subscribeToForeground, subscribeToNotifications } from '../src/app-services';
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
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [failureCount, setFailureCount] = useState(0);

  // Nunca registra el error completo (puede traer SQL).
  const start = useCallback(async (isRetry: boolean): Promise<void> => {
    try {
      await initializeApp();
      setFailureCount(0);
      setStatus('ready');
    } catch (err) {
      console.error(...safeErrorLogArgs('Falló el arranque de la app.', err));
      setFailureCount((n) => nextFailureCount(n, isRetry));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    async function init() {
      await start(false);
    }
    init();
  }, [start]);

  const retry = useCallback(async () => {
    setStatus('loading');
    await start(true);
  }, [start]);

  // Al volver a primer plano se invalida todo (mes en curso, "Hoy", estado de próximos pagos).
  useEffect(() => (status === 'ready' ? subscribeToForeground() : undefined), [status]);

  // Tocar una notificación (o abrir la app desde ella) lleva a su pantalla; solo con la BD lista.
  useEffect(
    () => (status === 'ready' ? subscribeToNotifications((href) => router.push(href as Href)) : undefined),
    [status],
  );

  if (status === 'error') return <ErrorScreen onRetry={retry} failureCount={failureCount} />;
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfacePage }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
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
