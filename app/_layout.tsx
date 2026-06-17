import { useEffect, useState } from 'react';
import { Slot, useRouter, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { initializeDatabase } from '../src/database/initialize';
import { useUserStore } from '../src/store/useUserStore';
import { colors } from '../src/theme';

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
  return (
    <SafeAreaProvider>
      <Initializer>
        <RootNavigator />
      </Initializer>
    </SafeAreaProvider>
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
