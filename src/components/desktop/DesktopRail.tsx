import { usePathname, useRouter } from 'expo-router';
import { Pressable, View, type PressableStateCallbackType } from 'react-native';

import { activeRailKey, RAIL_ITEMS, RAIL_SETTINGS, type RailItem } from '../../navigation/desktop';
import { useTheme } from '../../theme';
import { Text } from '../ui/ds/Text';

export const RAIL_WIDTH = 76;

/** react-native-web agrega `hovered` al estado de Pressable. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean };

function RailButton({ item, active }: { item: RailItem; active: boolean }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const ink = active ? colors.inkOnBrand : colors.inkSecondary;
  return (
    <Pressable
      onPress={() => router.navigate(item.href)}
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      style={(state) => {
        const { hovered, pressed } = state as WebPressableState;
        return {
          width: 60,
          height: 54,
          borderRadius: radius.sm + 2,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          backgroundColor: active ? colors.brandPrimary : hovered ? colors.surfaceRaised : 'transparent',
          opacity: pressed ? 0.8 : 1,
        };
      }}
    >
      <Text variant="label" style={{ color: ink, fontSize: 13, fontWeight: '600' }}>
        {item.short}
      </Text>
      <Text variant="label" style={{ color: ink, fontSize: 10, lineHeight: 12 }} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/** Menú lateral fijo de escritorio (Design/escritorio, 1c): secciones arriba, Ajustes abajo. */
export function DesktopRail() {
  const { colors, radius, space } = useTheme();
  const active = activeRailKey(usePathname());
  return (
    <View
      accessibilityRole="menu"
      style={{
        width: RAIL_WIDTH,
        alignItems: 'center',
        gap: 2,
        paddingVertical: space[5] - 4,
        backgroundColor: colors.surfaceCard,
        borderRightWidth: 1,
        borderRightColor: colors.borderSubtle,
      }}
    >
      <View
        accessibilityElementsHidden
        style={{ width: 32, height: 32, borderRadius: radius.sm + 1, backgroundColor: colors.brandPrimary, marginBottom: space[5] - 4 }}
      />
      {RAIL_ITEMS.map((item) => (
        <RailButton key={item.key} item={item} active={active === item.key} />
      ))}
      <View style={{ flex: 1 }} />
      <RailButton item={RAIL_SETTINGS} active={active === RAIL_SETTINGS.key} />
    </View>
  );
}
