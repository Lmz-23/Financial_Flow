import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatLocalDate, localDateToEpochMs, type LocalDate } from '../../../domain/dates';
import { fullDateLabel } from '../../../lib/dateLabels';
import { useTheme } from '../../../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

export interface DatePickerFieldProps {
  /** Fecha elegida ('YYYY-MM-DD', hora local) o null si el campo opcional esta vacio. */
  value: LocalDate | null;
  onChange: (date: LocalDate | null) => void;
  /** Etiqueta del campo (tambien es el nombre accesible). */
  label: string;
  /** Texto cuando no hay fecha (campo opcional). */
  placeholder?: string;
  /** Muestra «Quitar fecha» cuando hay valor (solo para campos opcionales). */
  clearable?: boolean;
  minimumDate?: LocalDate;
  maximumDate?: LocalDate;
  style?: StyleProp<ViewStyle>;
}

/** Fecha local -> Date al mediodia: el selector nativo no cruza de dia por el huso. */
function toPickerDate(date: LocalDate): Date {
  return new Date(localDateToEpochMs(date, 12));
}

function fromPickerDate(date: Date): LocalDate {
  return formatLocalDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Campo de fecha con el selector nativo: en Android abre el dialogo del sistema; en iOS, una hoja
 * con el calendario en linea y «Listo». Trabaja con `LocalDate`, nunca con instantes UTC.
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
  const { colors, radius, space, type } = useTheme();
  const [iosDraft, setIosDraft] = useState<LocalDate | null>(null);
  const today = (() => {
    const now = new Date();
    return formatLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  })();
  const initial = value ?? today;
  const min = minimumDate ? toPickerDate(minimumDate) : undefined;
  const max = maximumDate ? toPickerDate(maximumDate) : undefined;

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toPickerDate(initial),
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(fromPickerDate(date));
        },
      });
    } else {
      setIosDraft(initial);
    }
  }

  return (
    <View style={[{ gap: space[1] + 2 }, style]}>
      <Text variant="label">{label}</Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? fullDateLabel(value) : placeholder}`}
        accessibilityHint="Abre el calendario"
        style={({ pressed }) => ({
          height: 48,
          paddingHorizontal: 14,
          justifyContent: 'center',
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.surfaceCard,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={[type.body, { color: value ? colors.inkPrimary : colors.inkSecondary }]}>
          {value ? fullDateLabel(value) : placeholder}
        </Text>
      </Pressable>
      {clearable && value ? (
        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          style={{ alignSelf: 'flex-start' }}
        >
          <Text variant="bodySm" tone="brand">
            Quitar fecha
          </Text>
        </Pressable>
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet visible={iosDraft !== null} onClose={() => setIosDraft(null)}>
          {iosDraft !== null ? (
            <DateTimePicker
              value={toPickerDate(iosDraft)}
              mode="date"
              display="inline"
              minimumDate={min}
              maximumDate={max}
              accentColor={colors.brandPrimary}
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
                if (date) setIosDraft(fromPickerDate(date));
              }}
            />
          ) : null}
          <Button
            label="Listo"
            onPress={() => {
              if (iosDraft !== null) onChange(iosDraft);
              setIosDraft(null);
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}
