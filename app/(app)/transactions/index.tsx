import { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { ListRow } from '../../../src/components/ui/ds/ListRow';
import { Text } from '../../../src/components/ui/ds/Text';
import { toLocalDate } from '../../../src/domain/dates';
import { useTransactions } from '../../../src/hooks/useTransactions';
import { transactionLabel } from '../../../src/lib/dashboardFormat';
import { relativeDateLabel } from '../../../src/lib/dateLabels';
import { routes } from '../../../src/navigation/routes';
import { useTheme } from '../../../src/theme';

type Item = ReturnType<typeof useTransactions>['items'][number];
interface DaySection {
  key: string;
  title: string;
  data: Item[];
}

const MSG_EMPTY = 'Todavía no hay transacciones.';

/** Transacciones (Dashboard.dc.html, onTransacciones): todas, agrupadas por dia, de la mas reciente a la mas antigua. */
export default function TransactionsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, now } = useTransactions();

  const sections = useMemo(() => {
    const byDay: DaySection[] = [];
    for (const tx of items) {
      const key = toLocalDate(tx.date);
      const last = byDay[byDay.length - 1];
      if (last && last.key === key) last.data.push(tx);
      else byDay.push({ key, title: relativeDateLabel(tx.date, now), data: [tx] });
    }
    return byDay;
  }, [items, now]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScreenHeader title="Transacciones" onBack={() => router.back()} />
      <SectionList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_MARGIN,
          paddingTop: space[2],
          paddingBottom: Math.max(insets.bottom, space[5]) + space[5],
        }}
        ListEmptyComponent={
          <Text variant="bodySm" tone="secondary">
            {MSG_EMPTY}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="secondary" accessibilityRole="header" style={{ paddingTop: space[4], paddingBottom: space[1] }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item: tx }) => {
          const category = tx.categoryName ?? tx.debtName;
          const date = relativeDateLabel(tx.date, now);
          return (
            <ListRow
              title={transactionLabel(tx)}
              subtitle={category ? `${date} · ${category}` : date}
              trailing={
                <Amount value={tx.type === 'INCOME' ? tx.amountMinor : -tx.amountMinor} variant="amountSm" tone="auto" />
              }
              onPress={() => router.push(routes.transaction(tx.id))}
              divider
            />
          );
        }}
      />
    </View>
  );
}
