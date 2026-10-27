import { useRouter } from 'expo-router';

import { commands } from '../../app-services';
import type { DebtsSummary } from '../../hooks/useDebts';
import { routes } from '../../navigation/routes';
import { Amount, Text, Widget } from '../ui/ds';
import { DashedAddButton, LinkButton, WidgetHeader } from './parts';

/** Widget "Deudas": saldo total y enlace a la lista, o la invitacion a agregar la primera. */
export function DebtsWidget({ summary }: { summary: DebtsSummary }) {
  const router = useRouter();
  return (
    <Widget>
      <WidgetHeader
        title="Deudas"
        deactivateLabel="Desactivar Deudas"
        onDeactivate={() => commands.settings.setWidget('debts', false)}
      />
      {summary.debts.length > 0 ? (
        <>
          <Amount value={summary.totalMinor} variant="amountMd" />
          <LinkButton label="Ver todas" comingSoon onPress={() => router.push(routes.debts())} />
        </>
      ) : (
        <>
          <Text variant="bodySm">Aún no has agregado ninguna.</Text>
          <DashedAddButton label="Agregar deuda" comingSoon onPress={() => router.push(routes.debtNew())} />
        </>
      )}
    </Widget>
  );
}
