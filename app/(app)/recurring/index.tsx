import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { ListRow } from '../../../src/components/ui/ds/ListRow';
import { Pill } from '../../../src/components/ui/ds/Pill';
import { Text } from '../../../src/components/ui/ds/Text';
import { useRecurringList } from '../../../src/hooks/useRecurring';
import { shortDateLabel } from '../../../src/lib/dateLabels';
import { frequencyLabel, sortRecurring } from '../../../src/lib/recurringForm';
import { routes } from '../../../src/navigation/routes';
import { useTheme } from '../../../src/theme';

// INFERIDOS (ni el diseño ni los docs los traen).
const MSG_EMPTY = 'Todavía no tienes pagos ni ingresos recurrentes.';
const MSG_DATELESS_HINT = 'Agrega la fecha de vencimiento para que te avisemos.';
const LABEL_NO_DATE = 'Sin fecha';

/** Lista de recurrentes (pagos e ingresos): se llega con «Ver todos» desde Próximos pagos (decisión 39). */
export default function RecurringListScreen() {
  const { space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = sortRecurring(useRecurringList());
  const hasDateless = items.some((r) => r.nextDueDate === null);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Recurrentes" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[3], paddingBottom: space[6] }}
      >
        {items.length === 0 ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_EMPTY}
          </Text>
        ) : (
          <>
            {hasDateless ? (
              <Text variant="bodySm" tone="secondary">
                {MSG_DATELESS_HINT}
              </Text>
            ) : null}
            <View>
              {items.map((item) => {
                const income = item.type === 'INCOME';
                const dated = item.nextDueDate !== null;
                const label = item.name ?? '';
                return (
                  <ListRow
                    key={item.id}
                    title={label}
                    subtitle={
                      dated
                        ? `${frequencyLabel(item.frequency)} · ${shortDateLabel(item.nextDueDate as string)}`
                        : frequencyLabel(item.frequency)
                    }
                    divider
                    onPress={() => router.push(routes.recurringEdit(item.id))}
                    accessibilityLabel={`${label}, ${income ? 'ingreso' : 'pago'}, ${frequencyLabel(item.frequency)}, ${
                      dated ? shortDateLabel(item.nextDueDate as string) : LABEL_NO_DATE
                    }`}
                    trailing={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                        {dated ? null : <Pill label={LABEL_NO_DATE} tone="debt" />}
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
              })}
            </View>
          </>
        )}
      </ScrollView>
      <View style={{ paddingTop: space[4], paddingHorizontal: SCREEN_MARGIN, paddingBottom: Math.max(insets.bottom, 28) }}>
        <Button label="Nuevo recurrente" onPress={() => router.push(routes.recurringNew())} />
      </View>
    </View>
  );
}
