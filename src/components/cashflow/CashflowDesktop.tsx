import { View } from 'react-native';

import { toLocalDate } from '../../domain/dates';
import { describeCashflowIndex, formatCashflowIndex, type MonthStatement } from '../../domain/rules/statement';
import { useCashflowTrend, usePassiveIncomesOfMonth, type CashflowTrendPoint } from '../../hooks/useCashflowDesktop';
import {
  LABEL_PASSIVE_INCOME,
  LABEL_TOTAL_EXPENSE,
  cashflowBarProgress,
  expenseBreakdownRows,
} from '../../lib/cashflowView';
import { monthShortLabel, monthYearLabel, shortDateLabel } from '../../lib/dateLabels';
import { CASHFLOW_SCALE_MARKS, trendHeights } from '../../lib/flowDesktop';
import { useTheme } from '../../theme';
import { DesktopPage } from '../desktop/DesktopPage';
import { Amount, Button, ProgressBar, Text, Widget } from '../ui/ds';

const TITLE = 'Índice de Flujo de Caja';
const TITLE_CALC = 'Cómo se calcula';
const CTA_PASSIVE = 'Marcar otro ingreso como pasivo';
const LABEL_FREEDOM = 'libertad financiera';
const FORMULA = 'ingreso pasivo ÷ gasto total';
const EXPLAIN =
  'Ingreso pasivo es plata que te entra sin que tengas que trabajar cada vez para recibirla: arriendos, intereses, dividendos o ventas de algo que ya creaste. Tu salario o un trabajo por encargo no cuentan. Cuando llegas al 100 %, ese ingreso paga todos tus gastos del mes.';
const TREND_HEIGHT = 96;

export interface CashflowDesktopProps {
  statement: MonthStatement;
  onMarkPassive: () => void;
}

function Scale({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {CASHFLOW_SCALE_MARKS.map((mark) => (
        <Text key={mark} variant="label" style={{ color }}>
          {mark === 100 ? `100 % · ${LABEL_FREEDOM}` : `${mark} %`}
        </Text>
      ))}
    </View>
  );
}

function Trend({ points }: { points: readonly CashflowTrendPoint[] }) {
  const { colors, radius, space } = useTheme();
  const heights = trendHeights(points.map((p) => p.percent));
  return (
    <Widget gap={space[4]}>
      <Text variant="h3" accessibilityRole="header">
        Últimos {points.length} meses
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[4] }}>
        {points.map((p, i) => {
          const last = i === points.length - 1;
          return (
            <View
              key={`${p.year}-${p.month}`}
              accessible
              accessibilityLabel={`${monthYearLabel(p.year, p.month)}: ${p.percent} %`}
              style={{ flex: 1, alignItems: 'center', gap: 6 }}
            >
              <Text variant="label" tone={last ? 'primary' : 'secondary'}>
                {p.percent} %
              </Text>
              <View style={{ height: TREND_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                <View
                  style={{
                    width: '60%',
                    maxWidth: 48,
                    height: Math.max(heights[i] > 0 ? 4 : 2, (heights[i] / 100) * TREND_HEIGHT),
                    borderRadius: radius.sm,
                    backgroundColor: last ? colors.brandPrimary : colors.borderSubtle,
                  }}
                />
              </View>
              <Text variant="label" tone={last ? 'primary' : 'secondary'}>
                {monthShortLabel(p.month)}
              </Text>
            </View>
          );
        })}
      </View>
    </Widget>
  );
}

/** Índice de Flujo de Caja en escritorio: hero con el camino al 100 %, cifras del mes y cómo se calcula. */
export function CashflowDesktop({ statement, onMarkPassive }: CashflowDesktopProps) {
  const passiveIncomes = usePassiveIncomesOfMonth();
  const trend = useCashflowTrend(6);
  // El último punto de la tendencia es el mes en curso.
  const { year, month } = trend[trend.length - 1];
  const { colors, space } = useTheme();
  const rows = expenseBreakdownRows(statement);

  return (
    <DesktopPage
      eyebrow={monthYearLabel(year, month)}
      title={TITLE}
      actions={<Button variant="ghost" fullWidth={false} label={CTA_PASSIVE} onPress={onMarkPassive} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[5] }}>
        <View style={{ flex: 3, minWidth: 0, gap: space[5] }}>
          <Widget variant="hero" gap={space[4]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] }}>
              <Text variant="h3" accessibilityRole="header">
                Cobertura
              </Text>
              <Text variant="bodySm" style={{ flexShrink: 1, textAlign: 'right' }}>
                {describeCashflowIndex(statement.index)}
              </Text>
            </View>
            <Text variant="amountLg" tone="brand" style={{ fontSize: 72, lineHeight: 76 }}>
              {formatCashflowIndex(statement.index)}
            </Text>
            <View style={{ gap: space[2] }}>
              <ProgressBar
                progress={cashflowBarProgress(statement.index)}
                height={12}
                accessibilityLabel="Avance hacia la libertad financiera"
              />
              <Scale color={colors.inkSecondary} />
            </View>
          </Widget>

          <View style={{ flexDirection: 'row', gap: space[5] }}>
            <Widget style={{ flex: 1 }}>
              <Text variant="label" tone="growth">
                {LABEL_PASSIVE_INCOME} del mes
              </Text>
              <Amount value={statement.ingresoPasivo} variant="amountLg" />
            </Widget>
            <Widget style={{ flex: 1 }}>
              <Text variant="label" tone="debt">
                {LABEL_TOTAL_EXPENSE}
              </Text>
              <Amount value={statement.gastoTotal} variant="amountLg" />
            </Widget>
          </View>

          <Trend points={trend} />
        </View>

        <View style={{ flex: 2, minWidth: 0, gap: space[5] }}>
          <Widget gap={space[3]}>
            <Text variant="h3" accessibilityRole="header">
              Ingresos pasivos de {monthYearLabel(year, month).split(' ')[0].toLowerCase()}
            </Text>
            {passiveIncomes.length === 0 ? (
              <Text variant="bodySm" tone="secondary">
                Aún no hay ingresos pasivos este mes.
              </Text>
            ) : (
              passiveIncomes.map((t, i) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space[3],
                    paddingTop: i === 0 ? 0 : space[3],
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <View style={{ flexShrink: 1, gap: 2 }}>
                    <Text variant="body" numberOfLines={1}>
                      {t.description}
                    </Text>
                    <Text variant="label" tone="secondary" numberOfLines={1}>
                      {[shortDateLabel(toLocalDate(t.date)), t.categoryName].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Amount value={t.amountMinor} variant="amountSm" tone="growth" />
                </View>
              ))
            )}
          </Widget>

          <Widget gap={space[3]}>
            <Text variant="h3" accessibilityRole="header">
              {TITLE_CALC}
            </Text>
            <Text variant="bodySm" style={{ fontFamily: 'monospace' }}>
              {FORMULA}
            </Text>
            <Text variant="bodySm" tone="secondary">
              {EXPLAIN}
            </Text>
            <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" tone="secondary">
                {LABEL_TOTAL_EXPENSE}
              </Text>
              <Amount value={statement.gastoTotal} variant="amountSm" />
            </View>
            {rows.map((row) => (
              <View key={row.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodySm" tone="secondary">
                  {row.label}
                </Text>
                <Amount value={row.value} variant="amountSm" />
              </View>
            ))}
          </Widget>
        </View>
      </View>
    </DesktopPage>
  );
}
