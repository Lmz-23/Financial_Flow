import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { commands } from '../../../src/app-services';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Input } from '../../../src/components/ui/ds/Input';
import { MoneyInput } from '../../../src/components/ui/ds/MoneyInput';
import { Pill } from '../../../src/components/ui/ds/Pill';
import { Text } from '../../../src/components/ui/ds/Text';
import { ACCOUNT_TYPE_OPTIONS } from '../../../src/lib/onboardingDraft';
import { errorMessage } from '../../../src/lib/screenErrors';
import { useTheme } from '../../../src/theme';
import { KeyboardScreen, KeyboardFooter } from '../../../src/components/screens/KeyboardScreen';

type AccountType = (typeof ACCOUNT_TYPE_OPTIONS)[number]['value'];

/** Agregar cuenta (Dashboard.dc.html, onAgregarCuenta): nombre, tipo y saldo inicial. */
export default function NewAccountScreen() {
  const { space } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('CASH');
  const [opening, setOpening] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica la cuenta.
  const saved = useRef(false);
  const [done, setDone] = useState(false);

  function save() {
    if (saved.current) return;
    try {
      commands.accounts.create({ name, type, openingMinor: opening ?? 0 });
      saved.current = true;
      setDone(true);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <KeyboardScreen>
      <ScreenHeader title="Agregar cuenta" onBack={() => router.back()} />
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
        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <KeyboardFooter>
        <Button label="Guardar cuenta" onPress={save} disabled={done} />
      </KeyboardFooter>
    </KeyboardScreen>
  );
}
