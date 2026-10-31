import { Stack } from 'expo-router';
import { View } from 'react-native';

import { DeferredScreen } from '../../src/components/desktop/DeferredScreen';
import { DesktopDialog } from '../../src/components/desktop/DesktopDialog';
import { DesktopRail } from '../../src/components/desktop/DesktopRail';
import { useDesktopShortcuts } from '../../src/components/desktop/useDesktopShortcuts';
import { RouteErrorBoundary } from '../../src/components/feedback/RouteErrorBoundary';
import { useIsDesktop } from '../../src/hooks/useLayoutSize';
import { isDialogRoute, skeletonFor } from '../../src/navigation/desktop';
import { useTheme } from '../../src/theme';

/** Excepciones de render en la zona (app): pantalla de error compartida con reintento. */
export { RouteErrorBoundary as ErrorBoundary };

/**
 * Stack de la app autenticada (sin tabs: el Dashboard es el centro). Las pantallas de F5b se
 * agregan como archivos de esta carpeta; las hojas ("Ya pague", pago, aporte) declaran
 * `presentation: 'formSheet'` (con `sheetAllowedDetents`) o `'modal'` en sus propias opciones.
 *
 * En escritorio (web con 600 px o más) el stack va al lado del menú lateral y los formularios
 * (`DIALOG_ROUTES`) se abren como ventana centrada sobre la pantalla anterior. Las demás pantallas
 * muestran su esqueleto un cuadro antes de montarse (`DeferredScreen`).
 */
export default function AppLayout() {
  const { colors } = useTheme();
  const desktop = useIsDesktop();
  useDesktopShortcuts(desktop);

  const stack = (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: colors.surfacePage },
        ...(desktop && isDialogRoute(route.name)
          ? { presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }
          : null),
      })}
      screenLayout={({ route, navigation, children }) =>
        !desktop ? (
          children
        ) : isDialogRoute(route.name) ? (
          <DesktopDialog onClose={() => navigation.goBack()}>{children}</DesktopDialog>
        ) : (
          <DeferredScreen variant={skeletonFor(route.name)}>{children}</DeferredScreen>
        )
      }
    >
      {/* El Dashboard va primero: al completar el onboarding, el guard de la raíz redirige a la primera
          pantalla declarada (en web era la hoja «Ya pagué» sin id: /recurring/undefined/confirm). */}
      <Stack.Screen name="index" />
      {/* Hoja «Ya pagué» (§6): la presentación debe conocerse al empujar la pantalla, por eso se declara aquí. */}
      <Stack.Screen
        name="recurring/[id]/confirm"
        options={
          desktop
            ? {}
            : {
                presentation: 'formSheet',
                sheetAllowedDetents: [0.7, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: 22,
                contentStyle: { backgroundColor: colors.surfaceCard },
              }
        }
      />
    </Stack>
  );

  if (!desktop) return stack;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.surfacePage }}>
      <DesktopRail />
      <View style={{ flex: 1, minWidth: 0 }}>{stack}</View>
    </View>
  );
}
