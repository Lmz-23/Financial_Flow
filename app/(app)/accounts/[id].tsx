import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { commands, getDomain } from '../../../src/app-services';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Input } from '../../../src/components/ui/ds/Input';
import { ListRow } from '../../../src/components/ui/ds/ListRow';
import { MoneyInput } from '../../../src/components/ui/ds/MoneyInput';
import { Text } from '../../../src/components/ui/ds/Text';
import { Widget } from '../../../src/components/ui/ds/Widget';
import { useAccount } from '../../../src/hooks';
import { useTransactions } from '../../../src/hooks/useTransactions';
import { transactionLabel } from '../../../src/lib/dashboardFormat';
import { relativeDateLabel } from '../../../src/lib/dateLabels';
import { errorMessage } from '../../../src/lib/screenErrors';
import { useTheme } from '../../../src/theme';

/** Texto aprobado por el usuario para la cuenta con movimientos (se archiva en vez de borrar). */
const MSG_ARCHIVE_CONFIRM = 'Esta cuenta tiene movimientos, así que la archivaremos en lugar de borrarla. Tu historial se conserva.';
const MSG_DELETE_CONFIRM = '¿Eliminar esta cuenta?';
const MSG_BALANCE_REQUIRED = 'Escribe el saldo de la cuenta.';
const MSG_NOT_FOUND = 'No encontramos esta cuenta.';

/** Detalle de cuenta (Dashboard.dc.html, onCuentaDetalle): saldo, edicion, movimientos y eliminar. */
export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const account = useAccount(id);
  const movements = useTransactions({ accountId: id });

  if (!account) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Cuenta" onBack={() => router.back()} />
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {MSG_NOT_FOUND}
        </Text>
      </View>
    );
  }

  return (
    <AccountDetail
      id={id}
      name={account.name}
      balanceMinor={account.availableMinor}
      movements={movements}
      onBack={() => router.back()}
    />
  );
}

type Movements = ReturnType<typeof useTransactions>;

function AccountDetail({
  id,
  name: initialName,
  balanceMinor,
  movements,
  onBack,
}: {
  id: string;
  name: string;
  balanceMinor: number;
  movements: Movements;
  onBack: () => void;
}) {
  const { colors, space } = useTheme();
  const [name, setName] = useState(initialName);
  const [balance, setBalance] = useState<number | null>(balanceMinor);
  const [error, setError] = useState<string | null>(null);

  function saveChanges() {
    if (balance === null) {
      setError(MSG_BALANCE_REQUIRED);
      return;
    }
    try {
      commands.accounts.update(id, {
        ...(name !== initialName ? { name } : {}),
        ...(balance !== balanceMinor ? { balanceMinor: balance } : {}),
      });
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function confirmRemoval() {
    let outcome;
    try {
      outcome = getDomain().accounts.removalOutcome(id);
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    const archiving = outcome === 'ARCHIVED';
    Alert.alert('Eliminar cuenta', archiving ? MSG_ARCHIVE_CONFIRM : MSG_DELETE_CONFIRM, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: archiving ? 'Archivar' : 'Eliminar',
        style: 'destructive',
        onPress: () => {
          try {
            commands.accounts.remove(id);
            onBack();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={initialName} onBack={onBack} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] }}
      >
        <View style={{ gap: 2 }}>
          <Amount value={balanceMinor} variant="amountLg" />
          <Text variant="bodySm" tone="secondary">
            Saldo actual
          </Text>
        </View>

        <Widget gap={space[4]}>
          <Text variant="h3" accessibilityRole="header">
            Editar cuenta
          </Text>
          <Input
            label="Nombre"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            autoCapitalize="sentences"
            returnKeyType="done"
          />
          <MoneyInput
            label="Saldo"
            value={balance}
            onChangeValue={(v) => {
              setBalance(v);
              setError(null);
            }}
          />
          {error ? (
            <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label="Guardar cambios" size="md" onPress={saveChanges} />
        </Widget>

        <View style={{ gap: 10 }}>
          <Text variant="label" tone="secondary">
            Movimientos de esta cuenta
          </Text>
          {movements.items.length === 0 ? (
            <Text variant="bodySm" tone="secondary">
              Todavía no hay movimientos en esta cuenta.
            </Text>
          ) : (
            movements.items.map((tx) => (
              <ListRow
                key={tx.id}
                title={transactionLabel(tx)}
                subtitle={relativeDateLabel(tx.date, movements.now)}
                trailing={
                  <Amount value={tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor} variant="amountSm" tone="auto" />
                }
              />
            ))
          )}
        </View>

        <Button label="Eliminar cuenta" variant="danger" size="md" onPress={confirmRemoval} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
