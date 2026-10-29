import { Stack } from 'expo-router';

import { RouteErrorBoundary } from '../../src/components/feedback/RouteErrorBoundary';
import { useTheme } from '../../src/theme';

/** Excepciones de render en la zona (app): pantalla de error compartida con reintento. */
export { RouteErrorBoundary as ErrorBoundary };

/**
 * Stack de la app autenticada (sin tabs: el Dashboard es el centro). Las pantallas de F5b se
 * agregan como archivos de esta carpeta; las hojas ("Ya pague", pago, aporte) declaran
 * `presentation: 'formSheet'` (con `sheetAllowedDetents`) o `'modal'` en sus propias opciones.
 */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfacePage } }}>
      {/* Hoja «Ya pagué» (§6): la presentación debe conocerse al empujar la pantalla, por eso se declara aquí. */}
      <Stack.Screen
        name="recurring/[id]/confirm"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.7, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 22,
          contentStyle: { backgroundColor: colors.surfaceCard },
        }}
      />
    </Stack>
  );
}
