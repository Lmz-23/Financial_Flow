import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { TransactionDetail } from '../../../src/components/transactions/TransactionDetail';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Text } from '../../../src/components/ui/ds/Text';
import { useTransaction } from '../../../src/hooks/useTransactions';

const MSG_NOT_FOUND = 'No encontramos esta transacción.';

/** Detalle de transaccion (Dashboard.dc.html, onTxDetalle). */
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tx = useTransaction(id);
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Detalle" onBack={() => router.back()} />
      {tx ? (
        <TransactionDetail tx={tx} layout="screen" onRemoved={() => router.back()} />
      ) : (
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {MSG_NOT_FOUND}
        </Text>
      )}
    </View>
  );
}
