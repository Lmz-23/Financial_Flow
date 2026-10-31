import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { monthBounds, parseLocalDate, toLocalDate, addMonthsToYearMonth } from '../../domain/dates';
import { useActivity } from '../../hooks/useActivity';
import { useFirstActivityDate } from '../../hooks/usePeriodReport';
import { transactionLabel } from '../../lib/dashboardFormat';
import { monthYearLabel, shortDateLabel } from '../../lib/dateLabels';
import { TRANSFER_TITLE } from '../../lib/activityView';
import {
  activityTotals,
  filterActivity,
  MOVEMENT_FILTERS,
  movementAccountLabel,
  movementAmount,
  movementCategoryLabel,
  movementKey,
  type MovementFilter,
} from '../../lib/movements';
import { useTheme } from '../../theme';
import type { ActivityItem } from '../../domain/services/ActivityService';
import { DataTable, type DataColumn } from '../desktop/DataTable';
import { DesktopPage } from '../desktop/DesktopPage';
import { ListDetailLayout } from '../desktop/ListDetailLayout';
import { Amount } from '../ui/ds/Amount';
import { PeriodStepper } from '../ui/ds/PeriodStepper';
import { SegmentedControl } from '../ui/ds/SegmentedControl';
import { Text } from '../ui/ds/Text';
import { TransactionDetail } from './TransactionDetail';
import { TransferDetail } from './TransferDetail';

const MSG_EMPTY = 'No hay movimientos en este periodo.';

function itemTitle(item: ActivityItem): string {
  return item.kind === 'TRANSFER' ? TRANSFER_TITLE : transactionLabel(item.transaction);
}

function Total({ label, value, tone }: { label: string; value: number; tone: 'growth' | 'debt' }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Amount value={value} variant="amountMd" tone={tone} />
    </View>
  );
}

/** Movimientos en escritorio (Design/escritorio 2b): tabla del mes con filtros y panel de detalle. */
export function MovementsDesktop() {
  const { space } = useTheme();
  const [month, setMonth] = useState(() => {
    const { year, month: m } = parseLocalDate(toLocalDate(Date.now()));
    return { year, month: m };
  });
  const [filter, setFilter] = useState<MovementFilter>('ALL');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { start, end } = monthBounds(month.year, month.month);
  const { items, now } = useActivity({ from: start, to: end });
  const firstDate = useFirstActivityDate();

  const today = parseLocalDate(toLocalDate(now));
  const isCurrentMonth = month.year === today.year && month.month === today.month;
  const first = firstDate ? parseLocalDate(firstDate) : null;
  const canPrevious = first === null ? false : month.year * 12 + month.month > first.year * 12 + first.month;
  const shift = (delta: number) => {
    setMonth(addMonthsToYearMonth(month.year, month.month, delta));
    setSelectedKey(null);
  };

  const totals = useMemo(() => activityTotals(items), [items]);
  const rows = useMemo(() => filterActivity(items, filter), [items, filter]);
  // Se busca entre las filas visibles: si el filtro oculta el movimiento abierto, el panel se cierra.
  const selected = selectedKey === null ? undefined : rows.find((item) => movementKey(item) === selectedKey);

  const columns: DataColumn<ActivityItem>[] = [
    {
      key: 'date',
      title: 'Fecha',
      width: 90,
      render: (item) => <Text variant="bodySm">{shortDateLabel(toLocalDate(item.date))}</Text>,
    },
    {
      key: 'description',
      title: 'Descripción',
      flex: 2,
      render: (item) => (
        <Text variant="body" numberOfLines={1}>
          {itemTitle(item)}
        </Text>
      ),
    },
    {
      key: 'category',
      title: 'Categoría',
      render: (item) => (
        <Text variant="bodySm" tone="secondary" numberOfLines={1}>
          {movementCategoryLabel(item)}
        </Text>
      ),
    },
    {
      key: 'account',
      title: 'Cuenta',
      flex: 1.5,
      render: (item) => (
        <Text variant="bodySm" tone="secondary" numberOfLines={1}>
          {movementAccountLabel(item)}
        </Text>
      ),
    },
    {
      key: 'amount',
      title: 'Monto',
      width: 140,
      align: 'right',
      render: (item) => <Amount value={movementAmount(item)} tone={item.kind === 'TRANSFER' ? 'neutral' : 'auto'} />,
    },
  ];

  const close = () => setSelectedKey(null);
  const detail = selected ? (
    selected.kind === 'TRANSACTION' ? (
      <TransactionDetail key={selectedKey} tx={selected.transaction} layout="panel" onClose={close} onRemoved={close} />
    ) : (
      <TransferDetail key={selectedKey} transfer={selected.transfer} layout="panel" onClose={close} onRemoved={close} />
    )
  ) : null;

  return (
    <ListDetailLayout
      detail={detail}
      list={
        <DesktopPage
          eyebrow={monthYearLabel(month.year, month.month)}
          title="Movimientos"
          actions={
            <View style={{ width: 260 }}>
              <PeriodStepper
                title={monthYearLabel(month.year, month.month)}
                onPrevious={() => shift(-1)}
                onNext={() => shift(1)}
                canPrevious={canPrevious}
                canNext={!isCurrentMonth}
                unitLabel="Mes"
              />
            </View>
          }
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[5], flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', gap: space[6] }}>
              <Total label="Ingresos" value={totals.incomeMinor} tone="growth" />
              <Total label="Gastos" value={totals.expenseMinor} tone="debt" />
            </View>
            <SegmentedControl
              options={MOVEMENT_FILTERS}
              value={filter}
              onChange={setFilter}
              accessibilityLabel="Filtrar movimientos"
              style={{ width: 420 }}
            />
          </View>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={movementKey}
            selectedKey={selectedKey}
            onRowPress={(item) => setSelectedKey(movementKey(item))}
            empty={MSG_EMPTY}
            accessibilityLabelFor={itemTitle}
          />
        </DesktopPage>
      }
    />
  );
}
