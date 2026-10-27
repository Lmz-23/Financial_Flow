import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { commands } from '../../../src/app-services';
import { KeyboardFooter, KeyboardScreen } from '../../../src/components/screens/KeyboardScreen';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { DatePickerField } from '../../../src/components/ui/ds/DatePickerField';
import { Input } from '../../../src/components/ui/ds/Input';
import { MoneyInput } from '../../../src/components/ui/ds/MoneyInput';
import { SegmentedControl } from '../../../src/components/ui/ds/SegmentedControl';
import { Text } from '../../../src/components/ui/ds/Text';
import type { LocalDate } from '../../../src/domain/dates';
import type { Minor } from '../../../src/domain/money';
import { buildCreateDebtInput, ratePreview, ratePreviewLabel } from '../../../src/lib/debtForm';
import { errorMessage } from '../../../src/lib/screenErrors';
import { fontFamilyFor, useTheme } from '../../../src/theme';

type RateMode = 'KNOWN' | 'UNKNOWN';

const RATE_OPTIONS = [
  { value: 'KNOWN', label: 'Conozco la tasa' },
  { value: 'UNKNOWN', label: 'No sé la tasa' },
] as const;

/** Agregar deuda (Dashboard.dc.html, onAgregarDeuda): nombre, saldo, tasa conocida o estimada y cuota. */
export default function NewDebtScreen() {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState<Minor | null>(null);
  const [mode, setMode] = useState<RateMode>('KNOWN');
  const [rateText, setRateText] = useState('');
  const [installment, setInstallment] = useState<Minor | null>(null);
  const [monthsText, setMonthsText] = useState('');
  const [dueDate, setDueDate] = useState<LocalDate | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica la deuda.
  const saved = useRef(false);
  const [done, setDone] = useState(false);

  const knowsRate = mode === 'KNOWN';
  const preview = ratePreview({ balance, installment, monthsText });

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setError(null);
    };
  }

  function save() {
    if (saved.current) return;
    const built = buildCreateDebtInput({ name, balance, knowsRate, rateText, installment, monthsText, dueDate });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    try {
      commands.debts.create(built.input);
      saved.current = true;
      setDone(true);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <KeyboardScreen>
      <ScreenHeader title="Agregar deuda" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        <Input
          label="Nombre"
          value={name}
          onChangeText={touch(setName)}
          placeholder="Ej. Tarjeta Visa, Préstamo auto"
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        <MoneyInput label="Saldo actual" value={balance} onChangeValue={touch(setBalance)} />

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            ¿Sabes la tasa de interés?
          </Text>
          <SegmentedControl
            options={RATE_OPTIONS}
            value={mode}
            onChange={touch(setMode)}
            accessibilityLabel="¿Sabes la tasa de interés?"
          />
        </View>

        {knowsRate ? (
          <Input
            label="Tasa de interés mensual"
            value={rateText}
            onChangeText={touch(setRateText)}
            placeholder="% mensual"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        ) : null}
        <MoneyInput label="Cuota mensual" value={installment} onChangeValue={touch(setInstallment)} />
        {knowsRate ? null : (
          <>
            <Input
              label="Meses que te faltan"
              value={monthsText}
              onChangeText={touch((t: string) => setMonthsText(t.replace(/\D/g, '')))}
              placeholder="0"
              keyboardType="number-pad"
              inputMode="numeric"
            />
            <View
              style={{
                gap: space[1],
                padding: 14,
                borderRadius: radius.sm,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <Text
                variant="bodySm"
                tone="brand"
                accessibilityLiveRegion="polite"
                style={{ fontFamily: fontFamilyFor('sans', 600) }}
              >
                {ratePreviewLabel(preview)}
              </Text>
              <Text variant="label" tone="secondary">
                Calculamos la tasa con la fórmula estándar de amortización.
              </Text>
            </View>
          </>
        )}

        {installment ? (
          <DatePickerField label="Día de vencimiento" value={dueDate} onChange={touch(setDueDate)} clearable />
        ) : null}

        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <KeyboardFooter>
        <Button label="Guardar deuda" onPress={save} disabled={done} />
      </KeyboardFooter>
    </KeyboardScreen>
  );
}
