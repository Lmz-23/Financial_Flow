import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { routes } from '../../../navigation/routes';
import { fontFamilyFor, useTheme } from '../../../theme';
import { Text } from '../../ui/ds';

/** Botón «+ Nueva transacción» con la pista del atajo (Ctrl N), a la derecha de la cabecera. */
export function NewTransactionButton() {
  const router = useRouter();
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nueva transacción"
      accessibilityHint="Atajo: Control N"
      onPress={() => router.push(routes.transactionNew())}
      style={({ pressed }) => ({
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: space[4],
        borderRadius: radius.sm,
        backgroundColor: colors.brandPrimary,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text variant="body" style={{ color: colors.inkOnBrand, fontFamily: fontFamilyFor('sans', 600) }}>
        + Nueva transacción
      </Text>
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.inkOnBrand,
          opacity: 0.8,
        }}
      >
        <Text variant="label" style={{ color: colors.inkOnBrand, fontFamily: fontFamilyFor('mono', 400), fontSize: 11 }}>
          Ctrl N
        </Text>
      </View>
    </Pressable>
  );
}
