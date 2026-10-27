import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { commands } from '../../../src/app-services';
import { KeyboardFooter, KeyboardScreen } from '../../../src/components/screens/KeyboardScreen';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { AccountPicker } from '../../../src/components/ui/ds/AccountPicker';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Input } from '../../../src/components/ui/ds/Input';
import { MoneyInput } from '../../../src/components/ui/ds/MoneyInput';
import { Text } from '../../../src/components/ui/ds/Text';
import { useAccounts } from '../../../src/hooks';
import { errorMessage } from '../../../src/lib/screenErrors';
import { routes } from '../../../src/navigation/routes';
import { useTheme } from '../../../src/theme';

/** Inferido (mismo texto que Nueva transacción): el ahorro inicial sale de una cuenta y no hay ninguna. */
const MSG_NO_ACCOUNTS = 'Primero agrega una cuenta.';

/** Crear meta (Dashboard.dc.html, onCrearMeta): nombre, objetivo y ahorro inicial opcional que sale de una cuenta. */
export default function NewGoalScreen() {
  const { space } = useTheme();
  const router = useRouter();
  const { accounts } = useAccounts();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [initial, setInitial] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica la meta.
  const saved = useRef(false);
  const [done, setDone] = useState(false);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;

  function save() {
    if (saved.current) return;
    const initialMinor = initial ?? 0;
    if (initialMinor > 0 && !selectedAccountId) {
      setError(MSG_NO_ACCOUNTS);
      return;
    }
    try {
      commands.goals.create({
        name,
        targetMinor: target ?? 0,
        // El ahorro inicial es un aporte desde la cuenta; sin ahorro no se envía cuenta.
        ...(initialMinor > 0 && selectedAccountId ? { initialMinor, accountId: selectedAccountId } : {}),
      });
      saved.current = true;
      setDone(true);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <KeyboardScreen>
      <ScreenHeader title="Crear meta" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        <Input
          label="Nombre de la meta"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder="Ej. Vacaciones, carro nuevo"
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        <MoneyInput
          label="Monto objetivo"
          value={target}
          onChangeValue={(v) => {
            setTarget(v);
            setError(null);
          }}
        />
        <MoneyInput
          label="¿Ya tienes algo ahorrado? (opcional)"
          value={initial}
          onChangeValue={(v) => {
            setInitial(v);
            setError(null);
          }}
        />
        <AccountPicker
          label="Si ya tienes algo ahorrado, ¿de qué cuenta sale?"
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.availableMinor }))}
          selectedId={selectedAccountId}
          onSelect={(id) => {
            setAccountId(id);
            setError(null);
          }}
          emptyText={MSG_NO_ACCOUNTS}
        />
        {accounts.length === 0 ? (
          <Button label="Agregar cuenta" variant="ghost" size="md" onPress={() => router.push(routes.accountNew())} />
        ) : null}
        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <KeyboardFooter>
        <Button label="Guardar meta" onPress={save} disabled={done} />
      </KeyboardFooter>
    </KeyboardScreen>
  );
}
