import { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { ActivityListRow } from '../../../src/components/transactions/ActivityListRow';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Text } from '../../../src/components/ui/ds/Text';
import { MovementsDesktop } from '../../../src/components/transactions/MovementsDesktop';
import { useActivity } from '../../../src/hooks/useActivity';
import { useIsDesktop } from '../../../src/hooks/useLayoutSize';
import { activityRow, groupActivityByDay } from '../../../src/lib/activityView';
import { useTheme } from '../../../src/theme';

const MSG_EMPTY = 'Todavía no hay transacciones.';

/** Movimientos (Dashboard.dc.html, onTransacciones): transacciones y transferencias, agrupadas por dia, de la mas reciente a la mas antigua. */
export default function TransactionsScreen() {
  const desktop = useIsDesktop();
  return desktop ? <MovementsDesktop /> : <TransactionsMobile />;
}

function TransactionsMobile() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, now } = useActivity();

  const sections = useMemo(
    () => groupActivityByDay(items.map((item) => activityRow(item, now, { withCategory: true })), now),
    [items, now],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScreenHeader title="Transacciones" onBack={() => router.back()} />
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
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
        renderItem={({ item: row }) => <ActivityListRow row={row} divider />}
      />
    </View>
  );
}
