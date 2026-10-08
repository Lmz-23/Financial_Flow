import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { routes } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { SCREEN_MARGIN, Text } from '../ui/ds';
import { SlidersIcon } from './icons';

/** Cabecera: saludo, titulo y boton de Ajustes. */
export function DashboardHeader() {
  const router = useRouter();
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingTop: space[5],
        paddingHorizontal: SCREEN_MARGIN,
        paddingBottom: space[2],
      }}
    >
      <View style={{ gap: 2 }}>
        <Text variant="bodySm" tone="secondary">
          Hola
        </Text>
        <Text variant="h1" accessibilityRole="header">
          Tu panorama
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
        onPress={() => router.push(routes.settings())}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.surfaceCard,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <SlidersIcon color={colors.inkSecondary} />
      </Pressable>
    </View>
  );
}
