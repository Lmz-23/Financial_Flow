import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlowBarChart } from '../../src/components/cashflow/FlowBarChart';
import { ScreenHeader } from '../../src/components/screens/ScreenHeader';
import { Amount, PeriodStepper, ProgressBar, SegmentedControl, Text, Widget } from '../../src/components/ui/ds';
import { SCREEN_MARGIN } from '../../src/components/ui/ds/constants';
import { toLocalDate } from '../../src/domain/dates';
import { comparePeriods, periodOf, shiftPeriod, type Period, type PeriodKind } from '../../src/domain/rules/periods';
import type { CategoryLine } from '../../src/domain/services/ReportService';
import { useFirstActivityDate, usePeriodReport } from '../../src/hooks/usePeriodReport';
import {
  PERIOD_OPTIONS,
  bucketLongLabel,
  bucketShortLabel,
  categoryLineLabel,
  periodSpan,
  periodTitle,
  sharePercent,
} from '../../src/lib/flowDetail';
import { useTheme } from '../../src/theme';

// INFERIDOS: el diseño no trae esta pantalla (pedido de Leonardo, 2026-10-28).
const TITLE = 'Detalle del flujo';
const MSG_TAP_BAR = 'Toca una barra para ver ese tramo.';
const MSG_NO_INCOME = 'Sin ingresos en este periodo.';
const MSG_NO_EXPENSE = 'Sin gastos en este periodo.';

function Legend({ color, label }: { color: string; label: string }) {
  const { radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: color }} />
      <Text variant="label" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function Breakdown({ title, tone, total, lines, empty }: {
  title: string;
  tone: 'growth' | 'debt';
  total: number;
  lines: CategoryLine[];
  empty: string;
}) {
  const { space } = useTheme();
  return (
    <Widget gap={space[3] + 2}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        <Amount value={total} variant="amountMd" tone={tone} />
      </View>
      {lines.length === 0 ? (
        <Text variant="bodySm" tone="secondary">
          {empty}
        </Text>
      ) : (
        lines.map((line) => {
          const label = categoryLineLabel(line);
          const pct = sharePercent(line.totalMinor, total);
          return (
            <View key={line.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
                <Text variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {label}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Text variant="label" tone="secondary">
                    {pct}%
                  </Text>
                  <Amount value={line.totalMinor} variant="amountSm" />
                </View>
              </View>
              <ProgressBar progress={pct} tone={tone} height={6} accessibilityLabel={`${label}, ${pct}% de ${title.toLowerCase()}`} />
            </View>
          );
        })
      )}
    </Widget>
  );
}

/** Detalle del flujo: barras de ingresos y gastos por periodo y desglose por categoría. */
export default function FlowDetailScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [today] = useState(() => toLocalDate(Date.now()));
  const [period, setPeriod] = useState<Period>(() => periodOf('MONTH', today));
  const [selected, setSelected] = useState<number | null>(null);
  const report = usePeriodReport(period);
  // Se navega del periodo del primer dato guardado al actual; sin datos, solo el actual.
  const first = periodOf(period.kind, useFirstActivityDate() ?? today);
  const current = periodOf(period.kind, today);
  const canPrevious = comparePeriods(period, first) > 0;
  const canNext = comparePeriods(period, current) < 0;

  const goTo = (next: Period) => {
    setPeriod(next);
    setSelected(null);
  };

  const bucket = selected !== null ? report.buckets[selected] : undefined;
  const shownIncome = bucket?.ingresoTotal ?? report.statement.ingresoTotal;
  const shownExpense = bucket?.gastoTotal ?? report.statement.gastoTotal;
  const data = report.buckets.map((b, i) => ({
    label: bucketShortLabel(period.kind, b, i),
    longLabel: bucketLongLabel(period.kind, b, i),
    incomeMinor: b.ingresoTotal,
    expenseMinor: b.gastoTotal,
  }));

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={TITLE} onBack={() => router.back()} backLabel="Volver al panel" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] + insets.bottom }}
      >
        <SegmentedControl<PeriodKind>
          options={PERIOD_OPTIONS}
          value={period.kind}
          onChange={(kind) => goTo(periodOf(kind, today))}
          accessibilityLabel="Ver por"
        />
        <PeriodStepper
          title={periodTitle(period)}
          subtitle={periodSpan(period)}
          onPrevious={() => goTo(shiftPeriod(period, -1))}
          onNext={() => goTo(shiftPeriod(period, 1))}
          canPrevious={canPrevious}
          canNext={canNext}
          unitLabel="Periodo"
        />

        <Widget gap={space[4]}>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="secondary">
              {selected !== null ? data[selected].longLabel : periodTitle(period)}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space[2] }}>
              <View style={{ gap: 2 }}>
                <Text variant="label" tone="growth">
                  Ingresos
                </Text>
                <Amount value={shownIncome} variant="amountMd" />
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                <Text variant="label" tone="debt">
                  Gastos
                </Text>
                <Amount value={shownExpense} variant="amountMd" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space[2] }}>
              <Text variant="bodySm" tone="secondary">
                Balance
              </Text>
              <Amount value={shownIncome - shownExpense} variant="amountSm" tone="auto" />
            </View>
          </View>
          <FlowBarChart data={data} selected={selected} onSelect={setSelected} />
          <View style={{ flexDirection: 'row', gap: space[4] }}>
            <Legend color={colors.signalGrowth} label="Ingresos" />
            <Legend color={colors.signalDebt} label="Gastos" />
          </View>
          <Text variant="label" tone="secondary">
            {MSG_TAP_BAR}
          </Text>
        </Widget>

        <Breakdown
          title="Ingresos"
          tone="growth"
          total={report.statement.ingresoTotal}
          lines={report.incomeByCategory}
          empty={MSG_NO_INCOME}
        />
        <Breakdown
          title="Gastos"
          tone="debt"
          total={report.statement.gastoTotal}
          lines={report.expenseByCategory}
          empty={MSG_NO_EXPENSE}
        />
      </ScrollView>
    </View>
  );
}
