import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme';
import { MIN_TOUCH } from '../ui/ds/constants';
import { Text } from '../ui/ds/Text';
import { ChevronLeftIcon } from '../onboarding/icons';

function CloseIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" accessibilityElementsHidden>
      <Path d="M3.5 3.5L14.5 14.5M14.5 3.5L3.5 14.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** 'back' (flecha, por defecto) o 'close' (X, como en Nueva transaccion). */
  icon?: 'back' | 'close';
  backLabel?: string;
}

/** Cabecera de las pantallas de la app (Dashboard.dc.html): boton de 44 px y titulo h3. */
export function ScreenHeader({ title, onBack, icon = 'back', backLabel }: ScreenHeaderProps) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingTop: insets.top + space[3] + 2,
        paddingBottom: space[2],
        paddingHorizontal: space[4],
      }}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel ?? (icon === 'close' ? 'Cerrar' : 'Volver')}
        style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
      >
        {icon === 'close' ? <CloseIcon color={colors.inkPrimary} /> : <ChevronLeftIcon color={colors.inkPrimary} />}
      </Pressable>
      <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}
