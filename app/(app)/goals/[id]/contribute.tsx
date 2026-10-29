import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { commands } from '../../../../src/app-services';
import { KeyboardFooter, KeyboardScreen } from '../../../../src/components/screens/KeyboardScreen';
import { ScreenHeader } from '../../../../src/components/screens/ScreenHeader';
import { AccountPicker } from '../../../../src/components/ui/ds/AccountPicker';
import { Button } from '../../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../../src/components/ui/ds/constants';
import { MoneyInput } from '../../../../src/components/ui/ds/MoneyInput';
import { Text } from '../../../../src/components/ui/ds/Text';
import { useAccounts } from '../../../../src/hooks';
import { useGoal } from '../../../../src/hooks/useGoal';
import { errorMessage } from '../../../../src/lib/screenErrors';
import { routes } from '../../../../src/navigation/routes';
import { useTheme } from '../../../../src/theme';

/** Texto del diseño: es una transferencia interna, no un gasto. */
const MSG_TRANSFER_NOTE =
  'Este dinero sale de la cuenta que elijas — ya no aparece ahí como disponible — pero no es un gasto: sigue siendo tuyo, apartado en esta meta, hasta que la uses.';
/** Inferidos. */
const MSG_NO_ACCOUNTS = 'Primero agrega una cuenta.';
const MSG_NOT_FOUND = 'No encontramos esta meta.';
const MSG_NOT_ACTIVE = 'Esta meta ya está cerrada.';

/** Agregar a meta (Dashboard.dc.html, onAportarMeta): transferencia interna cuenta -> meta, no es un gasto. */
export default function ContributeGoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goal = useGoal(id);

  if (!goal || goal.status !== 'ACTIVE') {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Meta" onBack={() => router.back()} />
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {goal ? MSG_NOT_ACTIVE : MSG_NOT_FOUND}
        </Text>
      </View>
    );
  }
  return <ContributeForm goalId={id} goalName={goal.name} onBack={() => router.back()} />;
}

function ContributeForm({ goalId, goalName, onBack }: { goalId: string; goalName: string; onBack: () => void }) {
  const { space } = useTheme();
  const router = useRouter();
  const { accounts } = useAccounts();
  const [amount, setAmount] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica el aporte.
  const saved = useRef(false);
  const [done, setDone] = useState(false);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;

  function save() {
    if (saved.current) return;
    if (!selectedAccountId) {
      setError(MSG_NO_ACCOUNTS);
      return;
    }
    try {
      commands.goals.contribute({ goalId, accountId: selectedAccountId, amountMinor: amount ?? 0 });
      saved.current = true;
      setDone(true);
      onBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <KeyboardScreen>
      <ScreenHeader title={`Agregar a ${goalName}`} onBack={onBack} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        <MoneyInput
          label="Monto"
          value={amount}
          onChangeValue={(v) => {
            setAmount(v);
            setError(null);
          }}
        />
        <AccountPicker
          label="¿De qué cuenta sale?"
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.availableMinor }))}
          selectedId={selectedAccountId}
          onSelect={(accId) => {
            setAccountId(accId);
            setError(null);
          }}
          emptyText={MSG_NO_ACCOUNTS}
        />
        {accounts.length === 0 ? (
          <Button label="Agregar cuenta" variant="ghost" size="md" onPress={() => router.push(routes.accountNew())} />
        ) : null}
        <Text variant="bodySm" tone="secondary">
          {MSG_TRANSFER_NOTE}
        </Text>
        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <KeyboardFooter>
        <Button label="Agregar" onPress={save} disabled={done} />
      </KeyboardFooter>
    </KeyboardScreen>
  );
}
