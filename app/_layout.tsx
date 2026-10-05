import { useEffect, useState } from 'react';
import { Slot, useRouter, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { initializeDatabase } from '../src/database/initialize';
import { useUserStore } from '../src/store/useUserStore';
import { colors, ThemeProvider } from '../src/theme';
import { fontAssets } from '../src/theme/fontAssets';

// Retiene la pantalla de inicio hasta que las fuentes IBM Plex estén cargadas.
SplashScreen.preventAutoHideAsync();

function Initializer({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize database:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    }
    init();
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accentRed} />
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const onboardingCompleted = useUserStore((s) => s.settings.onboardingCompleted);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    // Only redirect once on mount
    if (redirected) return;

    // Don't redirect if already on onboarding or auth routes
    if (
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/(auth)') ||
      pathname.startsWith('/accounts') ||
      pathname.startsWith('/add-account')
    ) {
      return;
    }

    // Redirect based on onboarding status
    if (!onboardingCompleted) {
      router.replace('/onboarding');
    } else {
      // When onboarding is complete, go to tabs
      router.replace('/');
    }

    setRedirected(true);
  }, [onboardingCompleted, pathname, redirected]);

  return <Slot />;
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
    <ThemeProvider>
      <SafeAreaProvider>
        <Initializer>
          <RootNavigator />
        </Initializer>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
});
