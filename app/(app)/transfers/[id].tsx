import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { TransferDetail } from '../../../src/components/transactions/TransferDetail';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Text } from '../../../src/components/ui/ds/Text';
import { useTransfer } from '../../../src/hooks/useActivity';
import { MSG_TRANSFER_NOT_FOUND } from '../../../src/lib/transferForm';

/** Detalle de transferencia: datos, Editar y Eliminar (con confirmacion). */
export default function TransferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const transfer = useTransfer(id);
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Detalle" onBack={() => router.back()} />
      {transfer ? (
        <TransferDetail transfer={transfer} layout="screen" onRemoved={() => router.back()} />
      ) : (
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {MSG_TRANSFER_NOT_FOUND}
        </Text>
      )}
    </View>
  );
}
