import { Pressable, View } from 'react-native';

import { useTheme } from '../../../theme';
import { MIN_TOUCH } from './constants';
import { useFocusRing } from './useFocusRing';

export interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Nombre accesible (el de la fila que controla). */
  accessibilityLabel: string;
  disabled?: boolean;
}

/** Interruptor de 40x24 (Dashboard.dc.html, Ajustes): encendido signal-growth, apagado border-subtle. */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled = false }: ToggleProps) {
  const { colors, radius } = useTheme();
  const ring = useFocusRing();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      // Área táctil de 44 px alrededor del interruptor visible.
      style={[{ minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }, ring.style]}
    >
      <View
        style={{
          width: 40,
          height: 24,
          borderRadius: radius.full,
          padding: 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? colors.signalGrowth : colors.borderSubtle,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <View style={{ width: 20, height: 20, borderRadius: radius.full, backgroundColor: colors.inkOnBrand }} />
      </View>
    </Pressable>
  );
}
