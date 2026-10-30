import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commands } from '../../app-services';
import { toLocalDate } from '../../domain/dates';
import { useAccount } from '../../hooks';
import type { useTransfer } from '../../hooks/useActivity';
import { TRANSFER_TITLE } from '../../lib/activityView';
import { confirmAction } from '../../lib/confirmAction';
import { fullDateLabel, relativeDateLabel } from '../../lib/dateLabels';
import { errorMessage, MSG_ACCOUNT_ARCHIVED } from '../../lib/screenErrors';
import { routes } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { DefinitionList, DetailPanel, Tag } from '../desktop/DetailPanel';
import { Amount } from '../ui/ds/Amount';
import { Button } from '../ui/ds/Button';
import { SCREEN_MARGIN } from '../ui/ds/constants';
import { Text } from '../ui/ds/Text';
import { Widget } from '../ui/ds/Widget';
import { DetailRow } from './DetailRow';

const MSG_DELETE = '¿Eliminar esta transferencia? El dinero vuelve a la cuenta de origen.';

type TransferView = NonNullable<ReturnType<typeof useTransfer>>;

export interface TransferDetailProps {
  transfer: TransferView;
  /** Se llama tras eliminar: el celular vuelve atrás; el panel de escritorio se cierra. */
  onRemoved: () => void;
  layout: 'screen' | 'panel';
  /** Solo en 'panel'. */
  onClose?: () => void;
}

/** Detalle de transferencia: datos, Editar y Eliminar (con confirmación), en pantalla o en panel. */
export function TransferDetail({ transfer, onRemoved, layout, onClose }: TransferDetailProps) {
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
      onRemoved();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function confirmRemoval() {
    confirmAction({ title: 'Eliminar transferencia', message: MSG_DELETE, confirmLabel: 'Eliminar', onConfirm: removeAndLeave });
  }

  const actions = archived ? (
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
  );

  if (layout === 'panel') {
    const rows = [
      { label: 'Desde', value: transfer.fromAccountName },
      { label: 'Hacia', value: transfer.toAccountName },
      { label: 'Fecha', value: fullDateLabel(toLocalDate(transfer.date)) },
      ...(transfer.note !== null ? [{ label: 'Nota', value: transfer.note }] : []),
    ];
    return (
      <DetailPanel onClose={onClose ?? (() => undefined)} tags={<Tag label={TRANSFER_TITLE} />} footer={actions}>
        <View style={{ gap: 6 }}>
          <Amount value={transfer.amountMinor} variant="amountLg" tone="neutral" />
          <Text variant="body" tone="secondary">
            {TRANSFER_TITLE}
          </Text>
        </View>
        <DefinitionList items={rows} />
      </DetailPanel>
    );
  }

  return (
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

      {actions}
    </ScrollView>
  );
}
