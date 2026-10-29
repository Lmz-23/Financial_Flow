import { Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commands } from '../../../src/app-services';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Text } from '../../../src/components/ui/ds/Text';
import { Widget } from '../../../src/components/ui/ds/Widget';
import { useAccount } from '../../../src/hooks';
import { useTransfer } from '../../../src/hooks/useActivity';
import { TRANSFER_TITLE } from '../../../src/lib/activityView';
import { relativeDateLabel } from '../../../src/lib/dateLabels';
import { errorMessage, MSG_ACCOUNT_ARCHIVED } from '../../../src/lib/screenErrors';
import { MSG_TRANSFER_NOT_FOUND } from '../../../src/lib/transferForm';
import { routes } from '../../../src/navigation/routes';
import { useTheme } from '../../../src/theme';

const MSG_DELETE = '¿Eliminar esta transferencia? El dinero vuelve a la cuenta de origen.';

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

/** Detalle de transferencia: datos, Editar y Eliminar (con confirmacion). */
export default function TransferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const transfer = useTransfer(id);
  if (!transfer) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Detalle" onBack={() => router.back()} />
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {MSG_TRANSFER_NOT_FOUND}
        </Text>
      </View>
    );
  }
  return <TransferDetail transfer={transfer} />;
}

function TransferDetail({ transfer }: { transfer: NonNullable<ReturnType<typeof useTransfer>> }) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const from = useAccount(transfer.fromAccountId);
  const to = useAccount(transfer.toAccountId);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const archived = !from || !to || from.archivedAt !== null || to.archivedAt !== null;

  function removeAndLeave() {
    try {
      commands.transfers.remove(transfer.id);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function confirmRemoval() {
    Alert.alert('Eliminar transferencia', MSG_DELETE, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: removeAndLeave },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Detalle" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] + insets.bottom }}>
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: space[3] }}>
          <Amount value={transfer.amountMinor} variant="amountLg" tone="neutral" />
          <Text variant="body" tone="secondary">
            {TRANSFER_TITLE}
          </Text>
        </View>

        <Widget gap={space[3]}>
          <DetailRow label="Desde" value={transfer.fromAccountName} divider />
          <DetailRow label="Hacia" value={transfer.toAccountName} divider />
          <DetailRow label="Fecha" value={relativeDateLabel(transfer.date, now)} divider={transfer.note !== null} />
          {transfer.note !== null ? <DetailRow label="Nota" value={transfer.note} divider={false} /> : null}
        </Widget>

        {archived ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_ACCOUNT_ARCHIVED}
          </Text>
        ) : (
          <>
            {error ? (
              <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Button label="Editar" variant="ghost" size="md" onPress={() => router.push(routes.transferEdit(transfer.id))} />
            <Button label="Eliminar transferencia" variant="danger" size="md" onPress={confirmRemoval} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
