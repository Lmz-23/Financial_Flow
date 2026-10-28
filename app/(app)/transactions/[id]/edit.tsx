import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '../../../../src/components/screens/ScreenHeader';
import { TransactionForm } from '../../../../src/components/transactions/TransactionForm';
import { SCREEN_MARGIN } from '../../../../src/components/ui/ds/constants';
import { Text } from '../../../../src/components/ui/ds/Text';
import { useAccount } from '../../../../src/hooks';
import { useTransaction } from '../../../../src/hooks/useTransactions';
import { MSG_ACCOUNT_ARCHIVED, MSG_DEBT_PAYMENT_NOT_EDITABLE } from '../../../../src/lib/screenErrors';

const MSG_NOT_FOUND = 'No encontramos esta transacción.';

function Notice({ text }: { text: string }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Editar transacción" onBack={() => router.back()} />
      <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
        {text}
      </Text>
    </View>
  );
}

/** Editar transaccion: formulario precargado; un pago de deuda o una cuenta archivada solo muestran el aviso. */
export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tx = useTransaction(id);
  if (!tx) return <Notice text={MSG_NOT_FOUND} />;
  return <EditTransaction tx={tx} />;
}

function EditTransaction({ tx }: { tx: NonNullable<ReturnType<typeof useTransaction>> }) {
  const account = useAccount(tx.accountId);
  if (tx.kind === 'DEBT_PAYMENT') return <Notice text={MSG_DEBT_PAYMENT_NOT_EDITABLE} />;
  if (!account || account.archivedAt !== null) return <Notice text={MSG_ACCOUNT_ARCHIVED} />;
  return <TransactionForm key={tx.id} initial={{ mode: 'edit-transaction', transaction: tx }} />;
}
