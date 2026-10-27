import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { commands, ensureNotificationPermission } from '../../../src/app-services';
import { RecurringForm, type RecurringFormValues } from '../../../src/components/recurring/RecurringForm';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Text } from '../../../src/components/ui/ds/Text';
import type { LocalDate } from '../../../src/domain/dates';
import { useRecurringItem } from '../../../src/hooks/useRecurring';
import { errorMessage } from '../../../src/lib/screenErrors';
import { useTheme } from '../../../src/theme';

const MSG_NOT_FOUND = 'No encontramos este recurrente.';
// INFERIDOS (mismo patrón que «Eliminar cuenta»; lo que el dominio hace al borrar está en 3.4).
const MSG_DELETE_CONFIRM = '¿Eliminar este recurrente? Las transacciones que ya registraste se conservan.';

/** Edición de un recurrente (incluido el próximo pago, decisión 39) y eliminación con confirmación. */
export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const row = useRecurringItem(id);

  if (!row) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Recurrente" onBack={() => router.back()} />
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {MSG_NOT_FOUND}
        </Text>
      </View>
    );
  }

  const nextDueDate = row.nextDueDate as LocalDate | null;
  const initial: RecurringFormValues = {
    type: row.type,
    name: row.name ?? '',
    amountMinor: row.amountMinor,
    frequency: row.frequency,
    date: nextDueDate,
    accountId: row.defaultAccountId,
  };

  function save(values: RecurringFormValues): boolean {
    // El próximo pago editado pasa a ser el ancla: el servicio normaliza (quincenal) y reubica `nextDueDate`.
    const scheduleChanged = values.date !== nextDueDate || values.frequency !== row?.frequency;
    commands.recurring.update(id, {
      name: values.name,
      amountMinor: values.amountMinor ?? 0,
      frequency: values.frequency,
      defaultAccountId: values.accountId,
      ...(scheduleChanged ? { anchorDate: values.date } : {}),
    });
    router.back();
    // Completar la fecha de un recurrente del onboarding equivale a crear el primero con fecha (§7).
    if (nextDueDate === null && values.date !== null) void ensureNotificationPermission();
    return true;
  }

  return (
    <RecurringForm
      key={row.id}
      title={row.name ?? 'Recurrente'}
      initial={initial}
      typeLocked
      dateLabel={nextDueDate === null ? 'Día de vencimiento' : 'Próximo vencimiento'}
      submitLabel="Guardar cambios"
      onSubmit={save}
    >
      <DeleteButton id={id} onDone={() => router.back()} />
    </RecurringForm>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const { space } = useTheme();
  const [error, setError] = useState<string | null>(null);

  function confirmRemoval() {
    Alert.alert('Eliminar recurrente', MSG_DELETE_CONFIRM, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          try {
            commands.recurring.remove(id);
            onDone();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <View style={{ gap: space[2] }}>
      <Button label="Eliminar recurrente" variant="danger" size="md" onPress={confirmRemoval} />
      {error ? (
        <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
