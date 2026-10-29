import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../../theme';
import { MIN_TOUCH } from './constants';
import { Text } from './Text';
import type { TextTone } from './tone';
import { useFocusRing } from './useFocusRing';

interface PillBaseProps {
  label: string;
  /** Ícono o adorno a la izquierda del texto. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export interface PillProps extends PillBaseProps, Omit<PressableProps, 'children' | 'style'> {
  /** Estado seleccionado de una opción (chip de categoría o cuenta). Solo aplica si es pulsable. */
  selected?: boolean;
  /** Borde punteado de acción "agregar" (p. ej. "Nueva categoría"). Solo aplica si es pulsable. */
  dashed?: boolean;
  /** Tono del texto de una píldora ESTÁTICA (sin onPress), p. ej. 'growth' para "Ingreso pasivo". */
  tone?: Extract<TextTone, 'primary' | 'growth' | 'debt' | 'goal'>;
}

/**
 * Píldora (radio full).
 * - Con `onPress`: chip seleccionable de 13 px (padding 9/14, borde 1 px; seleccionado = brand).
 * - Sin `onPress`: etiqueta de estado estática sobre surface-raised (12 px, "Ingreso pasivo", fecha).
 */
export function Pill({
  label,
  leading,
  style,
  selected = false,
  dashed = false,
  tone = 'primary',
  onPress,
  disabled,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...rest
}: PillProps) {
  const { colors, radius, space } = useTheme();
  const ring = useFocusRing();

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel ?? label}
        style={[
          {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[1],
            paddingVertical: space[1] - 1,
            paddingHorizontal: space[2] + 2,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceRaised,
          },
          style,
        ]}
      >
        {leading}
        <Text variant="label" tone={tone}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      onFocus={(e) => {
        ring.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        ring.onBlur();
        onBlur?.(e);
      }}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH - 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2] - 2,
          paddingVertical: 9,
          paddingHorizontal: 14,
          borderRadius: radius.full,
          borderWidth: selected || dashed ? 1.5 : 1,
          borderStyle: dashed && !selected ? 'dashed' : 'solid',
          borderColor: selected ? colors.brandPrimary : colors.borderSubtle,
          backgroundColor: selected ? colors.brandPrimary : dashed ? 'transparent' : colors.surfaceCard,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        ring.style,
        style,
      ]}
    >
      {leading}
      <Text variant="bodySm" tone={selected ? 'onBrand' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}
