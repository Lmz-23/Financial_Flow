import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen name="add-account" />
      <Stack.Screen name="add-transaction" />
      <Stack.Screen name="transaction-detail" />
      <Stack.Screen name="category-detail" />
    </Stack>
  );
}
