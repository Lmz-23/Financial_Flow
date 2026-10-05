import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontFamilyFor, useTheme } from '../../../theme';
import { MIN_TOUCH, SEGMENTED_RADIUS } from './constants';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /**
   * Color de la opción activa: 'brand' (por defecto), o 'debt' / 'growth' cuando la opción
   * representa un dato (Gasto = debt, Ingreso = growth, como en Nueva transacción).
   */
  tone?: 'brand' | 'growth' | 'debt';
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo (p. ej. "Tipo de transacción"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function Segment<T extends string>({
  option,
  selected,
  onPress,
}: {
  option: SegmentedOption<T>;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radius, type } = useTheme();
  const ring = useFocusRing();
  const activeColor =
    option.tone === 'debt' ? colors.signalDebt : option.tone === 'growth' ? colors.signalGrowth : colors.brandPrimary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked: selected }}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={[
        {
          flex: 1,
          minHeight: MIN_TOUCH - 8,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
          backgroundColor: selected ? activeColor : 'transparent',
        },
        ring.style,
      ]}
    >
      <Text
        variant="bodySm"
        // El diseño usa 13 px con peso 500: la familia Medium lleva el peso (sin fontWeight).
        style={{ fontFamily: fontFamilyFor('sans', 500), fontSize: type.bodySm.fontSize }}
        // En el diseño la opción inactiva usa ink-secondary a 13 px; se degrada a ink-primary.
        tone={selected ? 'onBrand' : 'secondary'}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

/** Control segmentado (Gasto/Ingreso, Cuota/Abono extra, Claro/Oscuro/Sistema). Contenedor surface-raised. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const { colors, space } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'row',
          gap: space[1],
          padding: space[1],
          borderRadius: SEGMENTED_RADIUS,
          backgroundColor: colors.surfaceRaised,
        },
        style,
      ]}
    >
      {options.map((option) => (
        <Segment key={option.value} option={option} selected={option.value === value} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}
