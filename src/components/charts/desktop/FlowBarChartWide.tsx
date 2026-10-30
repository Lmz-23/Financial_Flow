import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatCOP } from '../../../domain/money';
import { compactCOP, niceAxisMax } from '../../../lib/flowDetail';
import { axisTicks, barHeightPercent, tooltipSide } from '../../../lib/flowDesktop';
import { useTheme } from '../../../theme';
import { Text } from '../../ui/ds';

export interface FlowBarWideDatum {
  label: string;
  /** Nombre completo del tramo ('Octubre 2026'), para lectores de pantalla y el cuadro del mouse. */
  longLabel: string;
  incomeMinor: number;
  expenseMinor: number;
  /** Tramo posterior a hoy: sale apagado y no se puede elegir. */
  future: boolean;
}

export interface FlowBarChartWideProps {
  data: readonly FlowBarWideDatum[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}

const PLOT_HEIGHT = 240;
const AXIS_WIDTH = 64;
const GRID_STEPS = 4;
const TIP_WIDTH = 168;

/**
 * Barras agrupadas ingresos/gastos que usan todo el ancho (escritorio). Pasar el mouse sobre un
 * tramo muestra sus montos; hacer clic lo elige (y filtra el resto de la pantalla). Los tramos
 * futuros salen apagados.
 */
export function FlowBarChartWide({ data, selected, onSelect }: FlowBarChartWideProps) {
  const { colors, radius, space } = useTheme();
  const [hovered, setHovered] = useState<number | null>(null);
  const axisMax = niceAxisMax(Math.max(0, ...data.map((d) => Math.max(d.incomeMinor, d.expenseMinor))));
  const ticks = axisTicks(axisMax, GRID_STEPS);

  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS_WIDTH, height: PLOT_HEIGHT, justifyContent: 'space-between' }}>
          {ticks.map((t, i) => (
            <Text
              key={i}
              variant="label"
              tone="secondary"
              style={{ fontSize: 11, lineHeight: 12, marginTop: i === 0 ? -6 : 0, marginBottom: i === GRID_STEPS ? -6 : 0 }}
            >
              {axisMax > 0 ? compactCOP(t) : i === GRID_STEPS ? '$0' : ''}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, height: PLOT_HEIGHT }}>
          {ticks.map((_, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: i === GRID_STEPS ? PLOT_HEIGHT - 1 : (PLOT_HEIGHT * i) / GRID_STEPS,
                height: 1,
                backgroundColor: colors.borderSubtle,
              }}
            />
          ))}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {data.map((d, i) => {
              const dim = d.future ? 0.35 : selected !== null && selected !== i ? 0.3 : 1;
              const active = hovered === i && !d.future;
              const income = barHeightPercent(d.incomeMinor, axisMax);
              const expense = barHeightPercent(d.expenseMinor, axisMax);
              const side = tooltipSide(i, data.length);
              return (
                <Pressable
                  key={i}
                  disabled={d.future}
                  onPress={() => onSelect(selected === i ? null : i)}
                  onHoverIn={() => setHovered(i)}
                  onHoverOut={() => setHovered((h) => (h === i ? null : h))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === i, disabled: d.future }}
                  accessibilityLabel={d.longLabel}
                  accessibilityHint="Muestra los ingresos y gastos de este tramo"
                  style={{
                    flex: 1,
                    height: PLOT_HEIGHT,
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: 3,
                    paddingHorizontal: 4,
                    backgroundColor: active ? colors.surfaceRaised : 'transparent',
                    borderRadius: radius.sm,
                    zIndex: active ? 2 : 0,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      maxWidth: 28,
                      height: `${income}%`,
                      backgroundColor: colors.signalGrowth,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                      opacity: dim,
                    }}
                  />
                  <View
                    style={{
                      flex: 1,
                      maxWidth: 28,
                      height: `${expense}%`,
                      backgroundColor: colors.signalDebt,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                      opacity: dim,
                    }}
                  />
                  {active ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: `${Math.max(income, expense)}%`,
                        marginBottom: 8,
                        width: TIP_WIDTH,
                        ...(side === 'left' ? { left: 0 } : side === 'right' ? { right: 0 } : { left: '50%', marginLeft: -TIP_WIDTH / 2 }),
                        gap: 2,
                        padding: space[3],
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        backgroundColor: colors.surfaceCard,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                      }}
                    >
                      <Text variant="label">{d.longLabel}</Text>
                      <Text variant="bodySm" tone="growth">
                        + {formatCOP(d.incomeMinor)}
                      </Text>
                      <Text variant="bodySm" tone="debt">
                        − {formatCOP(d.expenseMinor)}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
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
            style={{ flex: 1, textAlign: 'center', opacity: d.future ? 0.5 : 1 }}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
