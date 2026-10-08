import { useRouter } from 'expo-router';

import { commands } from '../../app-services';
import type { GoalView } from '../../domain/services/GoalService';
import { goalsCountLabel } from '../../lib/dashboardFormat';
import { routes } from '../../navigation/routes';
import { Text, Widget } from '../ui/ds';
import { DashedAddButton, LinkButton, WidgetHeader } from './parts';

/** Widget "Metas de ahorro": cuantas metas activas hay y enlace a la lista, o la invitacion a crear la primera. */
export function GoalsWidget({ goals }: { goals: GoalView[] }) {
  const router = useRouter();
  return (
    <Widget>
      <WidgetHeader
        title="Metas de ahorro"
        deactivateLabel="Desactivar Metas de ahorro"
        onDeactivate={() => commands.settings.setWidget('goals', false)}
      />
      {goals.length > 0 ? (
        <>
          <Text variant="bodySm">{goalsCountLabel(goals.length)}</Text>
          <LinkButton label="Ver todas" onPress={() => router.push(routes.goals())} />
        </>
      ) : (
        <>
          <Text variant="bodySm">Aún no tienes ninguna meta.</Text>
          <DashedAddButton label="Crear meta" onPress={() => router.push(routes.goalNew())} />
        </>
      )}
    </Widget>
  );
}
