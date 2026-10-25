import { Stack } from 'expo-router';

import { RouteErrorBoundary } from '../../src/components/feedback/RouteErrorBoundary';
import { useTheme } from '../../src/theme';

/** Excepciones de render en el onboarding: la misma pantalla de error con reintento (A15). */
export { RouteErrorBoundary as ErrorBoundary };

/** Stack del onboarding: 4 pasos (accounts, flow, widgets, done) con el borrador en memoria. */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfacePage } }} />;
}
