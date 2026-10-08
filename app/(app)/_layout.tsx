import { Stack } from 'expo-router';

import { useTheme } from '../../src/theme';

/**
 * Stack de la app autenticada (sin tabs: el Dashboard es el centro). Las pantallas de F5b se
 * agregan como archivos de esta carpeta; las hojas ("Ya pague", pago, aporte) declaran
 * `presentation: 'formSheet'` (con `sheetAllowedDetents`) o `'modal'` en sus propias opciones.
 */
export default function AppLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfacePage } }} />;
}
