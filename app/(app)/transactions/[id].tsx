import { Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { commands } from '../../../src/app-services';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Pill } from '../../../src/components/ui/ds/Pill';
import { Text } from '../../../src/components/ui/ds/Text';
import { Widget } from '../../../src/components/ui/ds/Widget';
import { AccountArchivedError } from '../../../src/domain/services/errors';
import { useAccount } from '../../../src/hooks';
import { useTransaction } from '../../../src/hooks/useTransactions';
import { transactionLabel } from '../../../src/lib/dashboardFormat';
import { relativeDateLabel } from '../../../src/lib/dateLabels';
import { errorMessage, MSG_DEBT_PAYMENT_NOT_EDITABLE } from '../../../src/lib/screenErrors';
import { routes } from '../../../src/navigation/routes';
import { useTheme } from '../../../src/theme';

/** Textos aprobados por el usuario (2026-10-26). */
const MSG_DELETE_EXPENSE = '¿Eliminar este gasto? Su monto vuelve al saldo de la cuenta.';
const MSG_DELETE_INCOME = '¿Eliminar este ingreso? Su monto se resta del saldo de la cuenta.';
const MSG_ARCHIVED_TITLE = 'Cuenta archivada';
const MSG_ARCHIVED_BODY = 'Esta transacción es de una cuenta archivada. Desarchívala para eliminarla.';
const MSG_NOT_FOUND = 'No encontramos esta transacción.';
const MSG_NO_CATEGORY = 'Sin categoría';

function DetailRow({ label, value, divider }: { label: string; value: string; divider: boolean }) {
  const { colors, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[3],
        paddingBottom: divider ? space[3] : 0,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Text variant="bodySm" tone="secondary">
        {label}
      </Text>
      <Text variant="body" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

/** Detalle de transaccion (Dashboard.dc.html, onTxDetalle). */
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tx = useTransaction(id);
  if (!tx) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Detalle" onBack={() => router.back()} />
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {MSG_NOT_FOUND}
        </Text>
      </View>
    );
  }
  return <TransactionDetail tx={tx} />;
}

function TransactionDetail({ tx }: { tx: NonNullable<ReturnType<typeof useTransaction>> }) {
  const id = tx.id;
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const account = useAccount(tx.accountId);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const isDebtPayment = tx.kind === 'DEBT_PAYMENT';
  // Cuenta archivada: modo lectura (sin Editar); eliminar sigue ofreciendo «Desarchivar».
  const canEdit = !isDebtPayment && account !== undefined && account.archivedAt === null;

  function removeAndLeave() {
    try {
      commands.transactions.remove(id);
      router.back();
    } catch (e) {
      if (e instanceof AccountArchivedError) {
        offerUnarchive(e);
        return;
      }
      setError(errorMessage(e));
    }
  }

  /** Contrato de F5 (ARCHITECTURE 6): ofrecer "Desarchivar" y reintentar el borrado. */
  function offerUnarchive(archived: AccountArchivedError) {
    Alert.alert(MSG_ARCHIVED_TITLE, MSG_ARCHIVED_BODY, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desarchivar',
        onPress: () => {
          try {
            commands.accounts.unarchive(archived.accountId);
          } catch (e) {
            setError(errorMessage(e));
            return;
          }
          removeAndLeave();
        },
      },
    ]);
  }

  function confirmRemoval() {
    Alert.alert('Eliminar transacción', tx.type === 'INCOME' ? MSG_DELETE_INCOME : MSG_DELETE_EXPENSE, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: removeAndLeave },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Detalle" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] + insets.bottom }}>
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: space[3] }}>
          <Amount value={tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor} variant="amountLg" tone="auto" />
          <Text variant="body" tone="secondary">
            {transactionLabel(tx)}
          </Text>
          {tx.isPassive ? <Pill label="Ingreso pasivo" tone="growth" style={{ marginTop: 6 }} /> : null}
        </View>

        <Widget gap={space[3]}>
          <DetailRow label="Categoría" value={tx.categoryName ?? tx.debtName ?? MSG_NO_CATEGORY} divider />
          <DetailRow label="Cuenta" value={tx.accountName} divider />
          <DetailRow label="Fecha" value={relativeDateLabel(tx.date, now)} divider={false} />
        </Widget>

        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {isDebtPayment ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_DEBT_PAYMENT_NOT_EDITABLE}
          </Text>
        ) : null}
        {canEdit ? (
          <Button label="Editar" variant="ghost" size="md" onPress={() => router.push(routes.transactionEdit(tx.id))} />
        ) : null}
        <Button label="Eliminar transacción" variant="danger" size="md" onPress={confirmRemoval} />
      </ScrollView>
    </View>
  );
}
