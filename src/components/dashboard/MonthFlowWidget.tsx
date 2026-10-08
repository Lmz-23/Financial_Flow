import { View } from 'react-native';

import type { MonthStatement } from '../../domain/rules/statement';
import { incomeSharePercent } from '../../lib/dashboardFormat';
import { useTheme } from '../../theme';
import { Amount, Text, Widget } from '../ui/ds';
import { WidgetHeader } from './parts';

/** "Flujo del mes": barra ingresos/gastos y los dos totales del mes calendario. */
export function MonthFlowWidget({ statement }: { statement: MonthStatement }) {
  const { colors, radius } = useTheme();
  const incomePct = incomeSharePercent(statement.ingresoTotal, statement.gastoTotal);
  return (
    <Widget gap={14}>
      <WidgetHeader title="Flujo del mes" />
      <View
        accessible
        accessibilityLabel={`Ingresos ${incomePct}% y gastos ${100 - incomePct}% del flujo del mes`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 8, borderRadius: radius.full, overflow: 'hidden' }}
      >
        <View style={{ width: `${incomePct}%`, height: '100%', backgroundColor: colors.signalGrowth }} />
        <View style={{ width: `${100 - incomePct}%`, height: '100%', backgroundColor: colors.signalDebt }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Text variant="label" tone="growth">
            Ingresos
          </Text>
          <Amount value={statement.ingresoTotal} variant="amountMd" />
        </View>
        <View style={{ gap: 2, alignItems: 'flex-end' }}>
          <Text variant="label" tone="debt">
            Gastos
          </Text>
          <Amount value={statement.gastoTotal} variant="amountMd" />
        </View>
      </View>
    </Widget>
  );
}
