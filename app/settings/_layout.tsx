import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="appearance" options={{ title: 'Apariencia' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notificaciones' }} />
      <Stack.Screen name="categories" options={{ title: 'Categorías' }} />
      <Stack.Screen name="distribution" options={{ title: 'Reglas de distribución' }} />
    </Stack>
  );
}
