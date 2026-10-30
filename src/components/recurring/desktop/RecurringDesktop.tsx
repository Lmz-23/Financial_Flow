import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { addMonthsToYearMonth, parseLocalDate, toLocalDate } from '../../../domain/dates';
import { useRecurringList } from '../../../hooks/useRecurring';
import { useUpcoming } from '../../../hooks/useUpcoming';
import { monthYearLabel, shortDateLabel } from '../../../lib/dateLabels';
import { currentWeekIn, isOverdueOccurrence, overdueDates } from '../../../lib/recurringDesktop';
import { frequencyLabel } from '../../../lib/recurringForm';
import { recurringByWeek } from '../../../lib/recurringWeeks';
import { routes } from '../../../navigation/routes';
import { useTheme } from '../../../theme';
import { DesktopPage } from '../../desktop/DesktopPage';
import { Tag } from '../../desktop/DetailPanel';
import { Amount } from '../../ui/ds/Amount';
import { Button } from '../../ui/ds/Button';
import { PeriodStepper } from '../../ui/ds/PeriodStepper';
import { Text } from '../../ui/ds/Text';

const MSG_EMPTY = 'Todavía no tienes pagos ni ingresos recurrentes.';
const MSG_DATELESS_HINT = 'Agrega la fecha de vencimiento para que te avisemos.';
const LABEL_NO_DATE = 'Sin fecha';
const MSG_EMPTY_WEEK = 'Nada esta semana.';

type Row = ReturnType<typeof useRecurringList>[number];

/** Recurrentes en escritorio (Design/escritorio, 2k): el mes en cuatro columnas, una por semana. */
export function RecurringDesktop() {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const items = useRecurringList();
  const upcoming = useUpcoming();
  const [today] = useState(() => toLocalDate(Date.now()));
  const [month, setMonth] = useState(() => {
    const { year, month: m } = parseLocalDate(today);
    return { year, month: m };
  });
  const { weeks, dateless } = recurringByWeek(items, month.year, month.month);
  const thisWeek = currentWeekIn(today, month.year, month.month);
  const overdue = overdueDates(upcoming);
  const shift = (delta: number) => setMonth(addMonthsToYearMonth(month.year, month.month, delta));

  return (
    <DesktopPage
      eyebrow="Pagos e ingresos"
      title="Recurrentes"
      actions={
        <Button label="+ Nuevo recurrente" size="md" fullWidth={false} onPress={() => router.push(routes.recurringNew())} />
      }
    >
      {items.length === 0 ? (
        <Text variant="bodySm" tone="secondary">
          {MSG_EMPTY}
        </Text>
      ) : (
        <>
          <View style={{ maxWidth: 360 }}>
            <PeriodStepper
              title={monthYearLabel(month.year, month.month)}
              onPrevious={() => shift(-1)}
              onNext={() => shift(1)}
              unitLabel="Mes"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'stretch' }}>
            {weeks.map((w) => {
              const current = w.week === thisWeek;
              return (
                <View
                  key={w.week}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    gap: space[3],
                    padding: space[3],
                    borderRadius: radius.md,
                    borderWidth: current ? 2 : 1,
                    borderColor: current ? colors.brandPrimary : colors.borderSubtle,
                    backgroundColor: colors.surfacePage,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' }}>
                    <Text variant="label" tone="secondary" accessibilityRole="header">
                      {w.title}
                    </Text>
                    {current ? <Tag label="Esta semana" tone="brand" /> : null}
                  </View>
                  {w.occurrences.length === 0 ? (
                    <Text variant="bodySm" tone="secondary">
                      {MSG_EMPTY_WEEK}
                    </Text>
                  ) : (
                    w.occurrences.map(({ item, date }) => (
                      <RecurringCard
                        key={`${item.id}:${date}`}
                        item={item}
                        date={date}
                        overdue={isOverdueOccurrence(overdue, item.id, date)}
                        onPress={() => router.push(routes.recurringEdit(item.id))}
                      />
                    ))
                  )}
                </View>
              );
            })}
          </View>
          {dateless.length > 0 ? (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="secondary" accessibilityRole="header">
                {LABEL_NO_DATE}
              </Text>
              <Text variant="bodySm" tone="secondary">
                {MSG_DATELESS_HINT}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                {dateless.map((item) => (
                  <View key={item.id} style={{ width: 280 }}>
                    <RecurringCard item={item} date={null} overdue={false} onPress={() => router.push(routes.recurringEdit(item.id))} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </DesktopPage>
  );
}

function RecurringCard({
  item,
  date,
  overdue,
  onPress,
}: {
  item: Row;
  date: string | null;
  overdue: boolean;
  onPress: () => void;
}) {
  const { colors, radius, space } = useTheme();
  const income = item.type === 'INCOME';
  const label = item.name ?? '';
  const when = date !== null ? `${frequencyLabel(item.frequency)} · ${shortDateLabel(date)}` : frequencyLabel(item.frequency);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${income ? 'ingreso' : 'pago'}, ${when}${overdue ? ', vencido' : ''}`}
      style={(state) => {
        const { hovered } = state as typeof state & { hovered?: boolean };
        return {
          gap: 4,
          padding: space[3],
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: overdue ? colors.signalDebt : colors.borderSubtle,
          backgroundColor: hovered ? colors.surfaceRaised : colors.surfaceCard,
        };
      }}
    >
      <Text variant="body" numberOfLines={2}>
        {label}
      </Text>
      {item.amountMinor === null ? (
        <Text variant="amountSm" tone="secondary">
          Sin definir
        </Text>
      ) : (
        <Amount value={item.amountMinor} variant="amountSm" tone={income ? 'growth' : 'neutral'} showSign={income} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] }}>
        <Text variant="label" tone="secondary">
          {when}
        </Text>
        {overdue ? <Tag label="Vencido" tone="debt" /> : null}
        {date === null ? <Tag label={LABEL_NO_DATE} tone="debt" /> : null}
      </View>
    </Pressable>
  );
}
