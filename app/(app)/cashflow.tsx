import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CashflowDesktop } from '../../src/components/cashflow/CashflowDesktop';
import { PassiveIncomeHelpSheet, PassiveIncomeInfoButton } from '../../src/components/help/PassiveIncomeHelp';
import { ScreenHeader } from '../../src/components/screens/ScreenHeader';
import { Amount, Button, ProgressBar, Text, Widget } from '../../src/components/ui/ds';
import { SCREEN_MARGIN } from '../../src/components/ui/ds/constants';
import { describeCashflowIndex, formatCashflowIndex } from '../../src/domain/rules/statement';
import { useMonthStatement } from '../../src/hooks';
import { useIsDesktop } from '../../src/hooks/useLayoutSize';
import {
  LABEL_PASSIVE_INCOME,
  LABEL_TOTAL_EXPENSE,
  cashflowBarProgress,
  expenseBreakdownRows,
} from '../../src/lib/cashflowView';
import { routes } from '../../src/navigation/routes';
import { useTheme } from '../../src/theme';

/** Título del diseño (Dashboard.dc.html, onCashflow). */
const TITLE = 'Índice de Flujo de Caja';
const TITLE_CALC = 'Cómo se calcula';
const CTA_PASSIVE = 'Marcar otro ingreso como pasivo';

/** Detalle de Cashflow (Dashboard.dc.html, onCashflow): Índice del mes, desglose y atajo a ingreso pasivo. */
export default function CashflowScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const statement = useMonthStatement();
  const [helpOpen, setHelpOpen] = useState(false);
  const rows = expenseBreakdownRows(statement);
  const desktop = useIsDesktop();

  if (desktop) {
    return <CashflowDesktop statement={statement} onMarkPassive={() => router.push(routes.transactionNewPassive())} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={TITLE} onBack={() => router.back()} backLabel="Volver al panel" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] + insets.bottom }}
      >
        <Widget variant="hero" gap={space[3] + 2}>
          <Text variant="amountLg" tone="brand" style={{ fontSize: 56, lineHeight: 60 }}>
            {formatCashflowIndex(statement.index)}
          </Text>
          <ProgressBar
            progress={cashflowBarProgress(statement.index)}
            height={10}
            accessibilityLabel="Avance hacia la libertad financiera"
          />
          <Text variant="bodySm">{describeCashflowIndex(statement.index)}</Text>
        </Widget>

        <Widget gap={space[3] + 2}>
          <Text variant="h3" accessibilityRole="header">
            {TITLE_CALC}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="body" tone="growth">
                {LABEL_PASSIVE_INCOME}
              </Text>
              <PassiveIncomeInfoButton onPress={() => setHelpOpen(true)} />
            </View>
            <Amount value={statement.ingresoPasivo} variant="amountSm" />
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body" tone="secondary">
              {LABEL_TOTAL_EXPENSE}
            </Text>
            <Amount value={statement.gastoTotal} variant="amountSm" />
          </View>
          {rows.map((row) => (
            <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="bodySm" tone="secondary">
                {row.label}
              </Text>
              <Amount value={row.value} variant="amountSm" />
            </View>
          ))}
        </Widget>

        <Button label={CTA_PASSIVE} onPress={() => router.push(routes.transactionNewPassive())} />
      </ScrollView>
      <PassiveIncomeHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}
