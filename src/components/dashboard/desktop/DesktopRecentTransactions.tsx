import { useRouter } from 'expo-router';

import { toLocalDate } from '../../../domain/dates';
import type { ActivityItem } from '../../../domain/services/ActivityService';
import { transactionLabel } from '../../../lib/dashboardFormat';
import { shortDateLabel } from '../../../lib/dateLabels';
import { routes } from '../../../navigation/routes';
import { DataTable, type DataColumn } from '../../desktop/DataTable';
import { Amount, Text, Widget } from '../../ui/ds';
import { LinkButton, WidgetHeader } from '../parts';

interface RecentRow {
  key: string;
  item: ActivityItem;
  date: string;
  description: string;
  category: string;
  account: string;
  amountMinor: number;
  tone: 'auto' | 'neutral';
  showSign: boolean;
}

function toRow(item: ActivityItem): RecentRow {
  const date = shortDateLabel(toLocalDate(item.date));
  if (item.kind === 'TRANSACTION') {
    const tx = item.transaction;
    return {
      key: `tx:${item.id}`,
      item,
      date,
      description: transactionLabel(tx),
      category: tx.categoryName ?? tx.debtName ?? '—',
      account: tx.accountName,
      amountMinor: tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor,
      tone: 'auto',
      showSign: false,
    };
  }
  const t = item.transfer;
  return {
    key: `tf:${item.id}`,
    item,
    date,
    description: 'Transferencia',
    category: '—',
    account: `${t.fromAccountName} → ${t.toAccountName}`,
    amountMinor: t.amountMinor,
    tone: 'neutral',
    showSign: false,
  };
}

const COLUMNS: readonly DataColumn<RecentRow>[] = [
  {
    key: 'date',
    title: 'Fecha',
    width: 72,
    render: (r) => (
      <Text variant="bodySm" tone="secondary" numberOfLines={1}>
        {r.date}
      </Text>
    ),
  },
  {
    key: 'description',
    title: 'Descripción',
    flex: 2,
    render: (r) => (
      <Text variant="body" numberOfLines={1}>
        {r.description}
      </Text>
    ),
  },
  {
    key: 'category',
    title: 'Categoría',
    flex: 1.2,
    render: (r) => (
      <Text variant="bodySm" tone="secondary" numberOfLines={1}>
        {r.category}
      </Text>
    ),
  },
  {
    key: 'account',
    title: 'Cuenta',
    flex: 1.4,
    render: (r) => (
      <Text variant="bodySm" tone="secondary" numberOfLines={1}>
        {r.account}
      </Text>
    ),
  },
  {
    key: 'amount',
    title: 'Monto',
    width: 130,
    align: 'right',
    render: (r) => <Amount value={r.amountMinor} variant="amountSm" tone={r.tone} showSign={r.showSign} />,
  },
];

/** "Últimos movimientos" en escritorio (2a): tabla con fecha, descripción, categoría, cuenta y monto. */
export function DesktopRecentTransactions({ items }: { items: ActivityItem[] }) {
  const router = useRouter();
  const rows = items.map(toRow);
  return (
    <Widget gap={14}>
      <WidgetHeader title="Últimos movimientos" />
      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.key}
        empty="Todavía no hay movimientos."
        accessibilityLabelFor={(r) => `${r.description}, ${r.date}`}
        onRowPress={(r) =>
          router.push(r.item.kind === 'TRANSFER' ? routes.transfer(r.item.id) : routes.transaction(r.item.id))
        }
      />
      <LinkButton label="Ver todas" onPress={() => router.push(routes.transactions())} />
    </Widget>
  );
}
