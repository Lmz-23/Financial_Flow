import { createElement, useId } from 'react';
import { Pressable, View } from 'react-native';

import { isValidLocalDate } from '../../../domain/dates';
import { useTheme } from '../../../theme';
import type { DatePickerFieldProps } from './DatePickerField';
import { Text } from './Text';

export type { DatePickerFieldProps } from './DatePickerField';

/**
 * Variante web (escritorio) del campo de fecha: `<input type="date">` del navegador, que ya trae
 * calendario y escritura con teclado. Su valor es 'YYYY-MM-DD', el mismo formato que `LocalDate`,
 * asi que no hay conversion de husos.
 */
export function DatePickerField({
  value,
  onChange,
  label,
  placeholder = 'Sin fecha',
  clearable = false,
  minimumDate,
  maximumDate,
  style,
}: DatePickerFieldProps) {
  const { colors, radius, space, type, scheme } = useTheme();
  const id = useId();

  const input = createElement('input', {
    id,
    type: 'date',
    value: value ?? '',
    min: minimumDate,
    max: maximumDate,
    'aria-label': label,
    title: value ? undefined : placeholder,
    onChange: (event: { target: { value: string } }) => {
      const next = event.target.value;
      if (next === '') {
        // Borrar con el teclado solo vacia el campo si es opcional.
        if (clearable) onChange(null);
        return;
      }
      if (isValidLocalDate(next)) onChange(next);
    },
    style: {
      height: 48,
      boxSizing: 'border-box',
      paddingInline: 14,
      borderRadius: radius.sm,
      border: `1px solid ${colors.borderSubtle}`,
      backgroundColor: colors.surfaceCard,
      color: value ? colors.inkPrimary : colors.inkSecondary,
      colorScheme: scheme,
      fontFamily: type.body.fontFamily,
      fontSize: type.body.fontSize,
      outlineColor: colors.focusRing,
    },
  });

  return (
    <View style={[{ gap: space[1] + 2 }, style]}>
      {createElement('label', { htmlFor: id }, <Text variant="label">{label}</Text>)}
      {input}
      {clearable && value ? (
        <Pressable onPress={() => onChange(null)} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
          <Text variant="bodySm" tone="brand">
            Quitar fecha
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
