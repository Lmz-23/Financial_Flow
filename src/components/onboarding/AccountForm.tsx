import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACCOUNT_TYPE_OPTIONS,
  accountErrorMessage,
  type AccountError,
  type AccountFormValues,
} from '../../lib/onboardingDraft';
import { useTheme } from '../../theme';
import { Button } from '../ui/ds/Button';
import { Input } from '../ui/ds/Input';
import { MIN_TOUCH, SCREEN_MARGIN } from '../ui/ds/constants';
import { MoneyInput } from '../ui/ds/MoneyInput';
import { Pill } from '../ui/ds/Pill';
import { Text } from '../ui/ds/Text';
import { ChevronLeftIcon } from './icons';

export interface AccountFormProps {
  /** Título de la pantalla («Agregar cuenta» al crear; el nombre de la cuenta al editar). */
  title: string;
  initial: AccountFormValues;
  onCancel: () => void;
  /** Devuelve el error de validación o null si se guardó. */
  onSubmit: (values: AccountFormValues) => AccountError | null;
}

/** Formulario de cuenta del paso 1 (Dashboard.dc.html, «Agregar cuenta»): nombre, tipo y saldo inicial. */
export function AccountForm({ title, initial, onCancel, onSubmit }: AccountFormProps) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [opening, setOpening] = useState<number | null>(initial.openingMinor);
  const [error, setError] = useState<AccountError | null>(null);

  // El botón atrás de Android cierra el formulario, no el paso.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [onCancel]);

  function save() {
    setError(onSubmit({ name, type, openingMinor: opening }));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeftIcon color={colors.inkPrimary} />
        </Pressable>
        <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        <Input
          label="Nombre de la cuenta"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder="Ej. Bancolombia ahorros"
          error={error ? accountErrorMessage(error) : undefined}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Tipo de cuenta
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <Pill key={o.value} label={o.label} selected={type === o.value} onPress={() => setType(o.value)} />
            ))}
          </View>
        </View>
        <MoneyInput label="Saldo inicial" value={opening} onChangeValue={setOpening} />
      </ScrollView>
      <View style={{ paddingTop: space[4], paddingHorizontal: SCREEN_MARGIN, paddingBottom: Math.max(insets.bottom, 28) }}>
        <Button label="Guardar cuenta" onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}
