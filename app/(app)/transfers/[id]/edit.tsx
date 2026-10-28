import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '../../../../src/components/screens/ScreenHeader';
import { TransactionForm } from '../../../../src/components/transactions/TransactionForm';
import { SCREEN_MARGIN } from '../../../../src/components/ui/ds/constants';
import { Text } from '../../../../src/components/ui/ds/Text';
import { useAccount } from '../../../../src/hooks';
import { useTransfer } from '../../../../src/hooks/useActivity';
import { MSG_ACCOUNT_ARCHIVED } from '../../../../src/lib/screenErrors';
import { MSG_TRANSFER_NOT_FOUND } from '../../../../src/lib/transferForm';

function Notice({ text }: { text: string }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Editar transferencia" onBack={() => router.back()} />
      <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
        {text}
      </Text>
    </View>
  );
}

/** Editar transferencia: el mismo formulario precargado; con una cuenta archivada solo muestra el aviso. */
export default function EditTransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transfer = useTransfer(id);
  if (!transfer) return <Notice text={MSG_TRANSFER_NOT_FOUND} />;
  return <EditTransfer transfer={transfer} />;
}

function EditTransfer({ transfer }: { transfer: NonNullable<ReturnType<typeof useTransfer>> }) {
  const from = useAccount(transfer.fromAccountId);
  const to = useAccount(transfer.toAccountId);
  if (!from || !to || from.archivedAt !== null || to.archivedAt !== null) return <Notice text={MSG_ACCOUNT_ARCHIVED} />;
  return <TransactionForm key={transfer.id} initial={{ mode: 'edit-transfer', transfer }} />;
}
