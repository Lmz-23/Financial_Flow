import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { SCREEN_MARGIN } from '../ui/ds';
import { FabPlusIcon } from './icons';

/** Boton flotante "Agregar transaccion" (56 px, esquina inferior derecha). */
export function AddTransactionFab() {
  const router = useRouter();
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar transacción"
      onPress={() => router.push(routes.transactionNew())}
      style={({ pressed }) => ({
        position: 'absolute',
        right: SCREEN_MARGIN,
        bottom: insets.bottom + space[5],
        width: 56,
        height: 56,
        borderRadius: radius.full,
        backgroundColor: colors.brandPrimary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <FabPlusIcon color={colors.inkOnBrand} />
    </Pressable>
  );
}
