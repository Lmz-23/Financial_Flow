import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function DebtLayout() {
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
        options={{ title: 'Deudas', headerShown: false }}
      />
      <Stack.Screen
        name="card/[id]"
        options={{ title: 'Tarjeta', headerShown: false }}
      />
      <Stack.Screen
        name="loan/[id]"
        options={{ title: 'Préstamo', headerShown: false }}
      />
      <Stack.Screen
        name="add-card"
        options={{ title: 'Nueva tarjeta', presentation: 'modal' }}
      />
      <Stack.Screen
        name="add-loan"
        options={{ title: 'Nuevo préstamo', presentation: 'modal' }}
      />
      <Stack.Screen
        name="pay-installment"
        options={{ title: 'Pagar cuota', presentation: 'modal' }}
      />
    </Stack>
  );
}
