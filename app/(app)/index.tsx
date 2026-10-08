import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountsSummaryWidget } from '../../src/components/dashboard/AccountsSummaryWidget';
import { AddTransactionFab } from '../../src/components/dashboard/AddTransactionFab';
import { CashflowIndexWidget } from '../../src/components/dashboard/CashflowIndexWidget';
import { DashboardHeader } from '../../src/components/dashboard/DashboardHeader';
import { DebtsWidget } from '../../src/components/dashboard/DebtsWidget';
import { GoalsWidget } from '../../src/components/dashboard/GoalsWidget';
import { InactiveWidgets } from '../../src/components/dashboard/InactiveWidgets';
import { MonthFlowWidget } from '../../src/components/dashboard/MonthFlowWidget';
import { RecentTransactionsWidget } from '../../src/components/dashboard/RecentTransactionsWidget';
import { UpcomingPaymentsWidget } from '../../src/components/dashboard/UpcomingPaymentsWidget';
import { SCREEN_MARGIN } from '../../src/components/ui/ds';
import { FAB_SIZE } from '../../src/components/ui/ds/constants';
import {
  useAccounts,
  useDebts,
  useGoals,
  useMonthStatement,
  useRecentTransactions,
  useSettings,
  useUpcoming,
} from '../../src/hooks';
import { useTheme } from '../../src/theme';

/** Dashboard: 4 widgets fijos, los opcionales activados y las invitaciones a los inactivos. */
export default function DashboardScreen() {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const { widgets } = useSettings();
  const accounts = useAccounts();
  const statement = useMonthStatement();
  const recent = useRecentTransactions(4);
  const upcoming = useUpcoming();
  const debts = useDebts();
  const goals = useGoals();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage, paddingTop: insets.top }}>
      <DashboardHeader />
      <ScrollView
        contentContainerStyle={{
          gap: space[5],
          paddingTop: space[4],
          paddingHorizontal: SCREEN_MARGIN,
          // Deja libre el boton flotante al final del scroll: FAB_SIZE + su margen inferior (space[5]) + holgura (space[6]).
          paddingBottom: FAB_SIZE + space[5] + space[6] + insets.bottom,
        }}
      >
        <AccountsSummaryWidget summary={accounts} />
        <MonthFlowWidget statement={statement} />
        <RecentTransactionsWidget transactions={recent.items} now={recent.now} />
        <UpcomingPaymentsWidget items={upcoming} />
        {widgets.cashflow ? <CashflowIndexWidget index={statement.index} /> : null}
        {widgets.debts ? <DebtsWidget summary={debts} /> : null}
        {widgets.goals ? <GoalsWidget goals={goals} /> : null}
        <InactiveWidgets active={widgets} />
      </ScrollView>
      <AddTransactionFab />
    </View>
  );
}
