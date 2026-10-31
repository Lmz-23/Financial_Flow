import type { ReactNode } from 'react';
import { View } from 'react-native';

import { dashboardRows, type DashboardWidgetKey } from '../../../lib/dashboardGrid';
import { useTheme } from '../../../theme';
import { useAccounts, useDebts, useGoals, useMonthStatement, useSettings, useUpcoming } from '../../../hooks';
import { useActivity } from '../../../hooks/useActivity';
import { useLayoutSize } from '../../../hooks/useLayoutSize';
import { DesktopPage } from '../../desktop/DesktopPage';
import { AccountsSummaryWidget } from '../AccountsSummaryWidget';
import { CashflowIndexWidget } from '../CashflowIndexWidget';
import { DebtsWidget } from '../DebtsWidget';
import { GoalsWidget } from '../GoalsWidget';
import { InactiveWidgets } from '../InactiveWidgets';
import { MonthFlowWidget } from '../MonthFlowWidget';
import { UpcomingPaymentsWidget } from '../UpcomingPaymentsWidget';
import { DesktopRecentTransactions } from './DesktopRecentTransactions';
import { NewTransactionButton } from './NewTransactionButton';

/** Dashboard de escritorio (Design/escritorio 2a): cuadrícula de 3 columnas ('wide') o 2 ('medium'). */
export function DesktopDashboard() {
  const { space } = useTheme();
  const size = useLayoutSize();
  const { widgets } = useSettings();
  const accounts = useAccounts();
  const statement = useMonthStatement();
  const recent = useActivity({ limit: 8 });
  const upcoming = useUpcoming();
  const debts = useDebts();
  const goals = useGoals();

  const content: Record<DashboardWidgetKey, ReactNode> = {
    cashflow: <CashflowIndexWidget index={statement.index} />,
    monthFlow: <MonthFlowWidget statement={statement} />,
    accounts: <AccountsSummaryWidget summary={accounts} />,
    recent: <DesktopRecentTransactions items={recent.items} />,
    upcoming: <UpcomingPaymentsWidget items={upcoming} />,
    debts: <DebtsWidget summary={debts} />,
    goals: <GoalsWidget goals={goals} />,
  };
  const columns = size === 'wide' ? 3 : 2;
  const rows = dashboardRows(size, widgets);

  return (
    <DesktopPage eyebrow="Hola" title="Tu panorama" actions={<NewTransactionButton />}>
      {rows.map((row) => {
        const used = row.reduce((sum, cell) => sum + cell.span, 0);
        return (
          <View key={row[0].key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[5] }}>
            {row.map((cell) => (
              <View key={cell.key} style={{ flex: cell.span, minWidth: 0 }}>
                {content[cell.key]}
              </View>
            ))}
            {used < columns ? <View style={{ flex: columns - used }} /> : null}
          </View>
        );
      })}
      <InactiveWidgets active={widgets} />
    </DesktopPage>
  );
}
