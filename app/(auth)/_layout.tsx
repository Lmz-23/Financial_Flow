import { useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import { useUserStore } from '../../src/store/useUserStore';

export default function AuthLayout() {
  const router = useRouter();
  const onboardingCompleted = useUserStore((s) => s.settings.onboardingCompleted);

  useEffect(() => {
    // If already completed onboarding, redirect to tabs
    if (onboardingCompleted) {
      router.replace('/');
    }
  }, [onboardingCompleted]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="onboarding/index" />
      <Stack.Screen name="onboarding/accounts" />
      <Stack.Screen name="onboarding/income" />
      <Stack.Screen name="onboarding/expenses" />
      <Stack.Screen name="onboarding/complete" />
    </Stack>
  );
}
