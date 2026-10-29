import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { ListRow } from '../../../src/components/ui/ds/ListRow';
import { PeriodStepper } from '../../../src/components/ui/ds/PeriodStepper';
import { Pill } from '../../../src/components/ui/ds/Pill';
import { Text } from '../../../src/components/ui/ds/Text';
import { addMonthsToYearMonth, parseLocalDate, toLocalDate } from '../../../src/domain/dates';
import { useRecurringList } from '../../../src/hooks/useRecurring';
import { monthYearLabel, shortDateLabel } from '../../../src/lib/dateLabels';
import { frequencyLabel } from '../../../src/lib/recurringForm';
import { recurringByWeek } from '../../../src/lib/recurringWeeks';
import { routes } from '../../../src/navigation/routes';
import { useTheme } from '../../../src/theme';

// INFERIDOS (ni el diseño ni los docs los traen).
const MSG_EMPTY = 'Todavía no tienes pagos ni ingresos recurrentes.';
const MSG_DATELESS_HINT = 'Agrega la fecha de vencimiento para que te avisemos.';
const LABEL_NO_DATE = 'Sin fecha';
const MSG_EMPTY_WEEK = 'Nada esta semana.';

type Row = ReturnType<typeof useRecurringList>[number];

function RecurringItemRow({ item, date }: { item: Row; date: string | null }) {
  const { space } = useTheme();
  const router = useRouter();
  const income = item.type === 'INCOME';
  const label = item.name ?? '';
  return (
    <ListRow
      title={label}
      subtitle={date !== null ? `${frequencyLabel(item.frequency)} · ${shortDateLabel(date)}` : frequencyLabel(item.frequency)}
      divider
      onPress={() => router.push(routes.recurringEdit(item.id))}
      accessibilityLabel={`${label}, ${income ? 'ingreso' : 'pago'}, ${frequencyLabel(item.frequency)}, ${
        date !== null ? shortDateLabel(date) : LABEL_NO_DATE
      }`}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          {date !== null ? null : <Pill label={LABEL_NO_DATE} tone="debt" />}
          {item.amountMinor === null ? (
            <Text variant="amountSm" tone="secondary">
              Sin definir
            </Text>
          ) : (
            <Amount value={item.amountMinor} variant="amountSm" tone={income ? 'growth' : 'neutral'} showSign={income} />
          )}
        </View>
      }
    />
  );
}

/**
 * Lista de recurrentes (pagos e ingresos): se llega con «Ver todos» desde Próximos pagos (decisión 39).
 * Se ve por mes, dividido en 4 semanas (1-7, 8-14, 15-21, 22-fin); los que no tienen fecha van al final.
 */
export default function RecurringListScreen() {
  const { space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useRecurringList();
  const [month, setMonth] = useState(() => {
    const { year, month: m } = parseLocalDate(toLocalDate(Date.now()));
    return { year, month: m };
  });
  const { weeks, dateless } = recurringByWeek(items, month.year, month.month);
  const shift = (delta: number) => setMonth(addMonthsToYearMonth(month.year, month.month, delta));

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Recurrentes" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] }}
      >
        {items.length === 0 ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_EMPTY}
          </Text>
        ) : (
          <>
            <PeriodStepper
              title={monthYearLabel(month.year, month.month)}
              onPrevious={() => shift(-1)}
              onNext={() => shift(1)}
              unitLabel="Mes"
            />
            {weeks.map((w) => (
              <View key={w.week} style={{ gap: space[1] }}>
                <Text variant="label" tone="secondary" accessibilityRole="header">
                  {w.title}
                </Text>
                {w.occurrences.length === 0 ? (
                  <Text variant="bodySm" tone="secondary" style={{ paddingVertical: space[2] }}>
                    {MSG_EMPTY_WEEK}
                  </Text>
                ) : (
                  <View>
                    {w.occurrences.map(({ item, date }) => (
                      <RecurringItemRow key={`${item.id}:${date}`} item={item} date={date} />
                    ))}
                  </View>
                )}
              </View>
            ))}
            {dateless.length > 0 ? (
              <View style={{ gap: space[1] }}>
                <Text variant="label" tone="secondary" accessibilityRole="header">
                  {LABEL_NO_DATE}
                </Text>
                <Text variant="bodySm" tone="secondary">
                  {MSG_DATELESS_HINT}
                </Text>
                <View>
                  {dateless.map((item) => (
                    <RecurringItemRow key={item.id} item={item} date={null} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={{ paddingTop: space[4], paddingHorizontal: SCREEN_MARGIN, paddingBottom: Math.max(insets.bottom, 28) }}>
        <Button label="Nuevo recurrente" onPress={() => router.push(routes.recurringNew())} />
      </View>
    </View>
  );
}
