import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AccountDetail } from '../../../src/components/accounts/AccountDetail';
import { KeyboardScreen } from '../../../src/components/screens/KeyboardScreen';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Text } from '../../../src/components/ui/ds/Text';
import { useAccount } from '../../../src/hooks';
import { useActivity } from '../../../src/hooks/useActivity';

const MSG_NOT_FOUND = 'No encontramos esta cuenta.';

/** Detalle de cuenta (Dashboard.dc.html, onCuentaDetalle): saldo, edicion, movimientos y eliminar. */
export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const account = useAccount(id);
  const movements = useActivity({ accountId: id });

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
    <KeyboardScreen>
      <ScreenHeader title={account.name} onBack={() => router.back()} />
      <AccountDetail account={account} movements={movements} layout="screen" onRemoved={() => router.back()} />
    </KeyboardScreen>
  );
}
