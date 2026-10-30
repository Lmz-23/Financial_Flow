import { useState } from 'react';
import { View } from 'react-native';

import { commands } from '../../app-services';
import { RefundAccountRequiredError } from '../../domain/services/errors';
import type { GoalView, RefundPreview } from '../../domain/services/GoalService';
import { formatCOP } from '../../domain/money';
import { useAccounts } from '../../hooks';
import { errorMessage } from '../../lib/screenErrors';
import { useTheme } from '../../theme';
import { AccountPicker } from '../ui/ds/AccountPicker';
import { Amount } from '../ui/ds/Amount';
import { Button } from '../ui/ds/Button';
import { Sheet } from '../ui/ds/Sheet';
import { Text } from '../ui/ds/Text';

const MSG_REFUND_INTRO = 'Esto es lo que se devolverá al eliminar la meta:';
const MSG_REFUND_ARCHIVED = 'archivada';
const MSG_REFUND_PICK = 'Algunas cuentas están archivadas. Elige una cuenta activa que reciba su dinero.';
const MSG_REFUND_REQUIRED = 'Elige una cuenta activa para recibir el dinero.';
const MSG_NO_ACTIVE_ACCOUNTS = 'Primero agrega una cuenta activa.';

/**
 * Contrato «Eliminar una meta» (ARCHITECTURE §6): con aportes de cuentas archivadas muestra el desglose y
 * pide una cuenta ACTIVA de destino; ante `RefundAccountRequiredError` vuelve a pedirla.
 */
export function RemoveGoalSheet({
  target,
  onClose,
  onRefresh,
}: {
  target: { goal: GoalView; preview: RefundPreview } | null;
  onClose: () => void;
  onRefresh: (goal: GoalView) => void;
}) {
  const { space } = useTheme();
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setAccountId(null);
    setError(null);
    onClose();
  }

  function confirm() {
    if (!target) return;
    if (!accountId) {
      setError(MSG_REFUND_REQUIRED);
      return;
    }
    try {
      commands.goals.remove(target.goal.id, { refundAccountId: accountId });
      close();
    } catch (e) {
      if (e instanceof RefundAccountRequiredError) {
        // La cuenta no sirvió (o cambió el desglose): se vuelve a pedir con la vista previa al día.
        setAccountId(null);
        setError(MSG_REFUND_REQUIRED);
        onRefresh(target.goal);
      } else {
        setError(errorMessage(e));
      }
    }
  }

  return (
    <Sheet visible={target !== null} onClose={close} accessibilityLabel="Eliminar meta">
      {target ? (
        <View style={{ gap: space[3] }}>
          <Text variant="h3" accessibilityRole="header">
            Eliminar meta
          </Text>
          <Text variant="bodySm" tone="secondary">
            {MSG_REFUND_INTRO}
          </Text>
          <View style={{ gap: space[1] }}>
            {target.preview.refunds.map((r) => (
              <View key={r.accountId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {r.accountArchived ? `${r.accountName} (${MSG_REFUND_ARCHIVED})` : r.accountName}
                </Text>
                <Amount value={r.amountMinor} variant="amountSm" />
              </View>
            ))}
          </View>
          <Text variant="bodySm" tone="secondary">
            {MSG_REFUND_PICK}
          </Text>
          <AccountPicker
            label={`Cuenta que recibe ${formatCOP(target.preview.requiresDestinationMinor)}`}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.availableMinor }))}
            selectedId={accountId}
            onSelect={(id) => {
              setAccountId(id);
              setError(null);
            }}
            emptyText={MSG_NO_ACTIVE_ACCOUNTS}
          />
          {error ? (
            <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label="Eliminar meta" variant="danger" size="md" onPress={confirm} />
          <Button label="Cancelar" variant="ghost" size="md" onPress={close} />
        </View>
      ) : null}
    </Sheet>
  );
}
