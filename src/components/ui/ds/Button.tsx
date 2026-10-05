import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { fontFamilyFor, useTheme } from '../../../theme';
import { MIN_TOUCH } from './constants';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** primary: marca; ghost: contorno neutro; danger: contorno terracota (acciones destructivas). */
  variant?: ButtonVariant;
  /** 'lg' = 52 px (CTA principal, por defecto); 'md' = 44 px (acciones secundarias). */
  size?: 'lg' | 'md';
  /** Texto del botón. */
  label: string;
  loading?: boolean;
  /** Ocupa todo el ancho disponible. Por defecto true (como en el diseño). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  variant = 'primary',
  size = 'lg',
  label,
  loading = false,
  fullWidth = true,
  disabled,
  style,
  accessibilityLabel,
  accessibilityState,
  onFocus,
  onBlur,
  ...rest
}: ButtonProps) {
  const { colors, radius, space } = useTheme();
  const ring = useFocusRing();
  const isDisabled = Boolean(disabled) || loading;

  const palette = {
    primary: { bg: colors.brandPrimary, border: colors.brandPrimary, text: colors.inkOnBrand },
    ghost: { bg: 'transparent', border: colors.borderSubtle, text: colors.inkPrimary },
    danger: { bg: 'transparent', border: colors.signalDebt, text: colors.signalDebt },
  }[variant];

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onFocus={(e) => {
        ring.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        ring.onBlur();
        onBlur?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: size === 'lg' ? 52 : MIN_TOUCH,
          borderRadius: radius.sm,
          paddingHorizontal: space[4],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        ring.style,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <Text variant={size === 'lg' ? 'h3' : 'bodySm'} style={[{ color: palette.text }, size === 'md' && { fontFamily: fontFamilyFor('sans', 600) }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
// Nota: el botón 'md' usa el cuerpo pequeño con el peso SemiBold del diseño (font-weight: 600);
// se sustituye la familia (el peso va en la familia), no `fontWeight`.
