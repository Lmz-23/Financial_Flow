import { Pressable, View } from 'react-native';

import { FREQUENCY_OPTIONS, type RecurringFrequency } from '../../lib/onboardingDraft';
import { fontFamilyFor, useTheme } from '../../theme';
import { MIN_TOUCH } from '../ui/ds/constants';
import { Text } from '../ui/ds/Text';

export interface FrequencyChipsProps {
  value: RecurringFrequency;
  onChange: (value: RecurringFrequency) => void;
  /** Color de la opción activa: crecimiento (ingreso) o deuda (gasto), como en Step2-Flujo. */
  tone: 'growth' | 'debt';
  accessibilityLabel: string;
}

/** Selector de frecuencia Semanal / Quincenal / Mensual (píldoras con el color del tipo de movimiento). */
export function FrequencyChips({ value, onChange, tone, accessibilityLabel }: FrequencyChipsProps) {
  const { colors, radius, space } = useTheme();
  const active = tone === 'growth' ? colors.signalGrowth : colors.signalDebt;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {FREQUENCY_OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH,
              justifyContent: 'center',
              paddingHorizontal: space[4],
              borderRadius: radius.full,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? active : colors.borderSubtle,
              backgroundColor: selected ? active : colors.surfaceCard,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              variant="bodySm"
              tone={selected ? 'onBrand' : 'secondary'}
              style={{ fontFamily: fontFamilyFor('sans', 500) }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
