import { useRouter } from 'expo-router';

import type { TransactionView } from '../../database/repositories/transactionRepository';
import { transactionLabel } from '../../lib/dashboardFormat';
import { relativeDateLabel } from '../../lib/dateLabels';
import { routes } from '../../navigation/routes';
import { Amount, ListRow, Widget } from '../ui/ds';
import { LinkButton, WidgetHeader } from './parts';

/** "Ultimos movimientos": los mas recientes y el enlace a la lista completa. */
export function RecentTransactionsWidget({ transactions, now }: { transactions: TransactionView[]; now: number }) {
  const router = useRouter();
  return (
    <Widget gap={14}>
      <WidgetHeader title="Últimos movimientos" />
      <>
        {transactions.map((tx) => (
          <ListRow
            key={tx.id}
            title={transactionLabel(tx)}
            subtitle={relativeDateLabel(tx.date, now)}
            trailing={
              <Amount value={tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor} variant="amountSm" tone="auto" />
            }
            onPress={() => router.push(routes.transaction(tx.id))}
          />
        ))}
      </>
      <LinkButton label="Ver todas" onPress={() => router.push(routes.transactions())} />
    </Widget>
  );
}
