import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { compactCOP, niceAxisMax } from '../../lib/flowDetail';
import { useTheme } from '../../theme';
import { Text } from '../ui/ds';

export interface FlowBarDatum {
  label: string;
  /** Nombre completo para lectores de pantalla ('Semana 2 · 8–14 oct'). */
  longLabel: string;
  incomeMinor: number;
  expenseMinor: number;
}

export interface FlowBarChartProps {
  data: readonly FlowBarDatum[];
  /** Barra elegida (null = ninguna). Las demás se atenúan. */
  selected: number | null;
  onSelect: (index: number | null) => void;
}

const PLOT_HEIGHT = 168;
const AXIS_WIDTH = 56;
const GRID_STEPS = 2;

/**
 * Barras agrupadas ingresos/gastos por semana o por mes. Se eligió sobre línea y torta: compara dos
 * montos en pocos periodos discretos (3-12), donde la altura se lee mejor que el ángulo o una pendiente.
 */
export function FlowBarChart({ data, selected, onSelect }: FlowBarChartProps) {
  const { colors, space } = useTheme();
  const [width, setWidth] = useState(0);
  const axisMax = niceAxisMax(Math.max(0, ...data.map((d) => Math.max(d.incomeMinor, d.expenseMinor))));
  const groupWidth = data.length > 0 ? width / data.length : 0;
  // Dos barras por grupo; con 12 meses quedan angostas, con 3-4 se limitan para no verse como bloques.
  const barGap = 2;
  const barWidth = Math.max(2, Math.min(22, (groupWidth - 6 - barGap) / 2));
  const heightOf = (minor: number) => (axisMax > 0 ? (minor / axisMax) * PLOT_HEIGHT : 0);
  const ticks = Array.from({ length: GRID_STEPS + 1 }, (_, i) => (axisMax * (GRID_STEPS - i)) / GRID_STEPS);

  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS_WIDTH, height: PLOT_HEIGHT, justifyContent: 'space-between' }}>
          {ticks.map((t, i) => (
            <Text key={i} variant="label" tone="secondary" style={{ fontSize: 11, lineHeight: 12, marginTop: i === 0 ? -6 : 0, marginBottom: i === GRID_STEPS ? -6 : 0 }}>
              {axisMax > 0 ? compactCOP(t) : i === GRID_STEPS ? '$0' : ''}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, height: PLOT_HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Svg width={width} height={PLOT_HEIGHT} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {ticks.map((_, i) => {
                const y = i === GRID_STEPS ? PLOT_HEIGHT - 0.5 : (PLOT_HEIGHT * i) / GRID_STEPS + 0.5;
                return <Line key={i} x1={0} x2={width} y1={y} y2={y} stroke={colors.borderSubtle} strokeWidth={1} />;
              })}
              {data.map((d, i) => {
                const center = groupWidth * i + groupWidth / 2;
                const dim = selected !== null && selected !== i ? 0.3 : 1;
                const income = heightOf(d.incomeMinor);
                const expense = heightOf(d.expenseMinor);
                return [
                  <Rect
                    key={`i${i}`}
                    x={center - barGap / 2 - barWidth}
                    y={PLOT_HEIGHT - income}
                    width={barWidth}
                    height={income}
                    rx={Math.min(3, barWidth / 3)}
                    fill={colors.signalGrowth}
                    opacity={dim}
                  />,
                  <Rect
                    key={`e${i}`}
                    x={center + barGap / 2}
                    y={PLOT_HEIGHT - expense}
                    width={barWidth}
                    height={expense}
                    rx={Math.min(3, barWidth / 3)}
                    fill={colors.signalDebt}
                    opacity={dim}
                  />,
                ];
              })}
            </Svg>
          ) : null}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
            {data.map((d, i) => (
              <Pressable
                key={i}
                style={{ flex: 1 }}
                onPress={() => onSelect(selected === i ? null : i)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === i }}
                accessibilityLabel={d.longLabel}
                accessibilityHint="Muestra los ingresos y gastos de este tramo"
              />
            ))}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', paddingLeft: AXIS_WIDTH }}>
        {data.map((d, i) => (
          <Text
            key={i}
            variant="label"
            tone={selected === i ? 'primary' : 'secondary'}
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center', fontSize: data.length > 6 ? 10 : 12 }}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
