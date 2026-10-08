import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function PocketsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Bolsillos', headerShown: false }}
      />
      <Stack.Screen
        name="add-funds"
        options={{ title: 'Agregar fondos', presentation: 'modal' }}
      />
    </Stack>
  );
}
