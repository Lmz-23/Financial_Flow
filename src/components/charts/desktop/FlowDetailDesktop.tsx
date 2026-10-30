import { View } from 'react-native';

import type { LocalDate } from '../../../domain/dates';
import type { Period, PeriodKind } from '../../../domain/rules/periods';
import type { CategoryLine, PeriodReport } from '../../../domain/services/ReportService';
import { isFutureBucket } from '../../../lib/flowDesktop';
import {
  PERIOD_OPTIONS,
  bucketLongLabel,
  bucketShortLabel,
  categoryLineLabel,
  periodSpan,
  periodTitle,
  sharePercent,
} from '../../../lib/flowDetail';
import { useTheme } from '../../../theme';
import { DesktopPage } from '../../desktop/DesktopPage';
import { Amount, PeriodStepper, ProgressBar, SegmentedControl, Text, Widget } from '../../ui/ds';
import { FlowBarChartWide } from './FlowBarChartWide';

const MSG_NO_INCOME = 'Sin ingresos en este periodo.';
const MSG_NO_EXPENSE = 'Sin gastos en este periodo.';

export interface FlowDetailDesktopProps {
  period: Period;
  report: PeriodReport;
  today: LocalDate;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onKindChange: (kind: PeriodKind) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
}

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

function CategoryBars({ title, tone, total, lines, empty }: {
  title: string;
  tone: 'growth' | 'debt';
  total: number;
  lines: CategoryLine[];
  empty: string;
}) {
  const { space } = useTheme();
  const top = lines.length > 0 ? lines[0].totalMinor : 0;
  return (
    <Widget style={{ flex: 1, minWidth: 0 }} gap={space[4]}>
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
          // Las barras se miden contra la mayor categoría (como el diseño); el % es sobre el total.
          const pct = sharePercent(line.totalMinor, total);
          return (
            <View key={line.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Text variant="body" numberOfLines={1} style={{ width: 140 }}>
                {label}
              </Text>
              <ProgressBar
                progress={top > 0 ? (line.totalMinor / top) * 100 : 0}
                tone={tone}
                height={8}
                style={{ flex: 1, width: undefined }}
                accessibilityLabel={`${label}, ${pct}% de ${title.toLowerCase()}`}
              />
              <Text variant="label" tone="secondary" style={{ width: 40, textAlign: 'right' }}>
                {pct}%
              </Text>
              <View style={{ width: 120, alignItems: 'flex-end' }}>
                <Amount value={line.totalMinor} variant="amountSm" />
              </View>
            </View>
          );
        })
      )}
    </Widget>
  );
}

/** Detalle del flujo en escritorio: totales y gráfico a lo ancho, y gastos e ingresos lado a lado. */
export function FlowDetailDesktop({
  period,
  report,
  today,
  selected,
  onSelect,
  onKindChange,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
}: FlowDetailDesktopProps) {
  const { colors, space } = useTheme();
  const bucket = selected !== null ? report.buckets[selected] : undefined;
  const shownIncome = bucket?.ingresoTotal ?? report.statement.ingresoTotal;
  const shownExpense = bucket?.gastoTotal ?? report.statement.gastoTotal;
  const data = report.buckets.map((b, i) => ({
    label: bucketShortLabel(period.kind, b, i),
    longLabel: bucketLongLabel(period.kind, b, i),
    incomeMinor: b.ingresoTotal,
    expenseMinor: b.gastoTotal,
    future: isFutureBucket(b.from, today),
  }));
  const scopeLabel = selected !== null ? data[selected].longLabel : periodTitle(period);

  return (
    <DesktopPage
      eyebrow="Ingresos y gastos"
      title="Detalle del flujo"
      actions={
        <>
          <View style={{ width: 340 }}>
            <SegmentedControl<PeriodKind>
              options={PERIOD_OPTIONS}
              value={period.kind}
              onChange={onKindChange}
              accessibilityLabel="Ver por"
            />
          </View>
          <View style={{ width: 240 }}>
            <PeriodStepper
              title={periodTitle(period)}
              subtitle={periodSpan(period)}
              onPrevious={onPrevious}
              onNext={onNext}
              canPrevious={canPrevious}
              canNext={canNext}
              unitLabel="Periodo"
            />
          </View>
        </>
      }
    >
      <Widget gap={space[4]} style={{ paddingHorizontal: space[5] + 4, paddingVertical: space[5] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 40 }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="growth">
              Ingresos · {scopeLabel}
            </Text>
            <Amount value={shownIncome} variant="amountMd" />
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="debt">
              Gastos · {scopeLabel}
            </Text>
            <Amount value={shownExpense} variant="amountMd" />
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="secondary">
              Balance
            </Text>
            <Amount value={shownIncome - shownExpense} variant="amountMd" tone="auto" />
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', gap: space[4] }}>
            <Legend color={colors.signalGrowth} label="Ingresos" />
            <Legend color={colors.signalDebt} label="Gastos" />
          </View>
        </View>
        <FlowBarChartWide data={data} selected={selected} onSelect={onSelect} />
        <Text variant="label" tone="secondary">
          {selected !== null ? `Seleccionado: ${data[selected].longLabel}. Haz clic de nuevo para quitarlo.` : 'Pasa el mouse sobre un tramo para ver sus montos; haz clic para resaltarlo.'}
        </Text>
      </Widget>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[5] }}>
        <CategoryBars
          title="Gastos"
          tone="debt"
          total={report.statement.gastoTotal}
          lines={report.expenseByCategory}
          empty={MSG_NO_EXPENSE}
        />
        <CategoryBars
          title="Ingresos"
          tone="growth"
          total={report.statement.ingresoTotal}
          lines={report.incomeByCategory}
          empty={MSG_NO_INCOME}
        />
      </View>
    </DesktopPage>
  );
}
