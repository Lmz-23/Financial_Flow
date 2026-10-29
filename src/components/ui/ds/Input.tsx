import { forwardRef } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '../../../theme';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface InputProps extends TextInputProps {
  /** Etiqueta del campo (también es el nombre accesible). */
  label?: string;
  /** Mensaje de error: pinta el borde con signal-debt y lo anuncia. */
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Estilo del TextInput (lo usa MoneyInput para la tipografía mono). */
  inputStyle?: StyleProp<TextStyle>;
}

/** Campo de texto: 48 px, radio sm, borde border-subtle; con foco usa focus-ring. */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, containerStyle, inputStyle, style, editable = true, accessibilityLabel, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors, radius, space, type } = useTheme();
  const ring = useFocusRing();

  return (
    <View style={[{ gap: space[1] + 2 }, containerStyle]}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        {...rest}
        ref={ref}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error}
        accessibilityState={{ disabled: !editable }}
        placeholderTextColor={colors.inkSecondary}
        selectionColor={colors.brandPrimary}
        onFocus={(e) => {
          ring.onFocus();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          ring.onBlur();
          onBlur?.(e);
        }}
        style={[
          type.body,
          {
            height: 48,
            paddingHorizontal: 14,
            paddingVertical: 0,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: error ? colors.signalDebt : ring.focused ? colors.focusRing : colors.borderSubtle,
            backgroundColor: editable ? colors.surfaceCard : colors.surfaceRaised,
            color: colors.inkPrimary,
            opacity: editable ? 1 : 0.6,
          },
          ring.style,
          inputStyle,
          style,
        ]}
      />
      {error ? (
        <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
