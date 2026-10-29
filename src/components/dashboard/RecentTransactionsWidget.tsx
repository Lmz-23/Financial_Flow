import { useRouter } from 'expo-router';

import type { ActivityItem } from '../../domain/services/ActivityService';
import { activityRow } from '../../lib/activityView';
import { routes } from '../../navigation/routes';
import { ActivityListRow } from '../transactions/ActivityListRow';
import { Widget } from '../ui/ds';
import { LinkButton, WidgetHeader } from './parts';

/** "Ultimos movimientos": transacciones y transferencias mas recientes y el enlace a la lista completa. */
export function RecentTransactionsWidget({ items, now }: { items: ActivityItem[]; now: number }) {
  const router = useRouter();
  return (
    <Widget gap={14}>
      <WidgetHeader title="Últimos movimientos" />
      <>
        {items.map((item) => {
          const row = activityRow(item, now);
          return <ActivityListRow key={row.key} row={row} />;
        })}
      </>
      <LinkButton label="Ver todas" onPress={() => router.push(routes.transactions())} />
    </Widget>
  );
}
