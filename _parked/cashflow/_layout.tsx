import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function CashflowLayout() {
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
        options={{ title: 'Cash Flow', headerShown: false }}
      />
    </Stack>
  );
}
