import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commands } from '../../app-services';
import { AccountArchivedError } from '../../domain/services/errors';
import { toLocalDate } from '../../domain/dates';
import { useAccount } from '../../hooks';
import type { useTransaction } from '../../hooks/useTransactions';
import { confirmAction } from '../../lib/confirmAction';
import { transactionLabel } from '../../lib/dashboardFormat';
import { fullDateLabel, relativeDateLabel } from '../../lib/dateLabels';
import { NO_CATEGORY_LABEL } from '../../lib/movements';
import { errorMessage, MSG_DEBT_PAYMENT_NOT_EDITABLE } from '../../lib/screenErrors';
import { routes } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { DefinitionList, DetailPanel, Tag } from '../desktop/DetailPanel';
import { Amount } from '../ui/ds/Amount';
import { Button } from '../ui/ds/Button';
import { SCREEN_MARGIN } from '../ui/ds/constants';
import { Pill } from '../ui/ds/Pill';
import { Text } from '../ui/ds/Text';
import { Widget } from '../ui/ds/Widget';
import { DetailRow } from './DetailRow';

/** Textos aprobados por el usuario (2026-10-26). */
const MSG_DELETE_EXPENSE = '¿Eliminar este gasto? Su monto vuelve al saldo de la cuenta.';
const MSG_DELETE_INCOME = '¿Eliminar este ingreso? Su monto se resta del saldo de la cuenta.';
const MSG_ARCHIVED_TITLE = 'Cuenta archivada';
const MSG_ARCHIVED_BODY = 'Esta transacción es de una cuenta archivada. Desarchívala para eliminarla.';

type TransactionView = NonNullable<ReturnType<typeof useTransaction>>;

export interface TransactionDetailProps {
  tx: TransactionView;
  /** Se llama tras eliminar: el celular vuelve atrás; el panel de escritorio se cierra. */
  onRemoved: () => void;
  /** 'screen': pantalla del celular (con scroll); 'panel': panel lateral de escritorio. */
  layout: 'screen' | 'panel';
  /** Solo en 'panel'. */
  onClose?: () => void;
}

/** Detalle de transacción (Dashboard.dc.html, onTxDetalle); la misma lógica en pantalla y en panel. */
export function TransactionDetail({ tx, onRemoved, layout, onClose }: TransactionDetailProps) {
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
      commands.transactions.remove(tx.id);
      onRemoved();
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
    confirmAction({
      title: MSG_ARCHIVED_TITLE,
      message: MSG_ARCHIVED_BODY,
      confirmLabel: 'Desarchivar',
      destructive: false,
      onConfirm: () => {
        try {
          commands.accounts.unarchive(archived.accountId);
        } catch (e) {
          setError(errorMessage(e));
          return;
        }
        removeAndLeave();
      },
    });
  }

  function confirmRemoval() {
    confirmAction({
      title: 'Eliminar transacción',
      message: tx.type === 'INCOME' ? MSG_DELETE_INCOME : MSG_DELETE_EXPENSE,
      confirmLabel: 'Eliminar',
      onConfirm: removeAndLeave,
    });
  }

  const errorText = error ? (
    <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
      {error}
    </Text>
  ) : null;
  const debtNote = isDebtPayment ? (
    <Text variant="bodySm" tone="secondary">
      {MSG_DEBT_PAYMENT_NOT_EDITABLE}
    </Text>
  ) : null;
  const editButton = canEdit ? (
    <Button label="Editar" variant="ghost" size="md" onPress={() => router.push(routes.transactionEdit(tx.id))} />
  ) : null;

  if (layout === 'panel') {
    const rows = [
      { label: 'Categoría', value: tx.categoryName ?? tx.debtName ?? NO_CATEGORY_LABEL },
      { label: 'Cuenta', value: tx.accountName },
      { label: 'Fecha', value: fullDateLabel(toLocalDate(tx.date)) },
      ...(tx.description.trim() ? [{ label: 'Descripción', value: tx.description.trim() }] : []),
    ];
    return (
      <DetailPanel
        onClose={onClose ?? (() => undefined)}
        tags={
          <>
            <Tag
              label={isDebtPayment ? 'Pago de deuda' : tx.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
              tone={tx.type === 'INCOME' ? 'growth' : 'debt'}
            />
            {tx.isPassive ? <Tag label="Ingreso pasivo" tone="growth" /> : null}
          </>
        }
        footer={
          <>
            {errorText}
            {debtNote}
            {editButton}
            <Button label="Eliminar transacción" variant="danger" size="md" onPress={confirmRemoval} />
          </>
        }
      >
        <View style={{ gap: 6 }}>
          <Amount value={tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor} variant="amountLg" tone="auto" />
          <Text variant="body" tone="secondary">
            {transactionLabel(tx)}
          </Text>
        </View>
        <DefinitionList items={rows} />
      </DetailPanel>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] + insets.bottom }}>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: space[3] }}>
        <Amount value={tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor} variant="amountLg" tone="auto" />
        <Text variant="body" tone="secondary">
          {transactionLabel(tx)}
        </Text>
        {tx.isPassive ? <Pill label="Ingreso pasivo" tone="growth" style={{ marginTop: 6 }} /> : null}
      </View>

      <Widget gap={space[3]}>
        <DetailRow label="Categoría" value={tx.categoryName ?? tx.debtName ?? NO_CATEGORY_LABEL} divider />
        <DetailRow label="Cuenta" value={tx.accountName} divider />
        <DetailRow label="Fecha" value={relativeDateLabel(tx.date, now)} divider={false} />
      </Widget>

      {errorText}
      {debtNote}
      {editButton}
      <Button label="Eliminar transacción" variant="danger" size="md" onPress={confirmRemoval} />
    </ScrollView>
  );
}
