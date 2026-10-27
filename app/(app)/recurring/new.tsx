import { useRouter } from 'expo-router';

import { commands, ensureNotificationPermission } from '../../../src/app-services';
import { RecurringForm, type RecurringFormValues } from '../../../src/components/recurring/RecurringForm';

const INITIAL: RecurringFormValues = {
  type: 'EXPENSE',
  name: '',
  amountMinor: null,
  frequency: 'MONTHLY',
  date: null,
  accountId: null,
};

/** Nuevo recurrente (Dashboard.dc.html, onAgregarRecurrente): tipo, nombre, monto, frecuencia, fecha y cuenta (D8). */
export default function NewRecurringScreen() {
  const router = useRouter();

  function create(values: RecurringFormValues): boolean {
    // `anchorDate` se envía tal cual: el servicio lo normaliza, y el ajuste quincenal ya se mostró en vivo.
    commands.recurring.create({
      type: values.type,
      name: values.name,
      amountMinor: values.amountMinor ?? 0,
      frequency: values.frequency,
      defaultAccountId: values.accountId,
      anchorDate: values.date,
    });
    router.back();
    // Permiso al crear un recurrente con fecha (§7); el sistema solo pregunta si aún no se decidió.
    if (values.date !== null) void ensureNotificationPermission();
    return true;
  }

  return (
    <RecurringForm
      title="Nuevo recurrente"
      initial={INITIAL}
      dateLabel="Día de vencimiento"
      submitLabel="Guardar"
      onSubmit={create}
    />
  );
}
