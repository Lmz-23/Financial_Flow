import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '../../theme';
import { Text } from '../ui/ds/Text';

/**
 * Contenido del panel lateral de detalle (Design/escritorio, 2b/2e/2g): fila superior con etiquetas
 * y cerrar, cuerpo con scroll y acciones fijas abajo. Va dentro de `ListDetailLayout`.
 */
export function DetailPanel({
  tags,
  onClose,
  footer,
  children,
}: {
  tags?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { space } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[2],
          paddingTop: space[6],
          paddingHorizontal: space[6],
          paddingBottom: space[3],
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], flexShrink: 1 }}>{tags}</View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar detalle" hitSlop={10}>
          <Text variant="h2" tone="secondary">
            ×
          </Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space[6], paddingBottom: space[5], gap: space[5] }}>
        {children}
      </ScrollView>
      {footer ? <View style={{ padding: space[6], paddingTop: space[3], gap: space[3] }}>{footer}</View> : null}
    </View>
  );
}

/** Etiqueta en píldora (Gasto, Ingreso pasivo, Vencido…). `tone` usa los colores de señal. */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'growth' | 'debt' | 'goal' | 'brand' }) {
  const { colors, radius } = useTheme();
  const ink = {
    neutral: colors.inkSecondary,
    growth: colors.signalGrowth,
    debt: colors.signalDebt,
    goal: colors.signalGoal,
    brand: colors.inkOnBrand,
  }[tone];
  const bg =
    tone === 'neutral'
      ? colors.surfaceRaised
      : tone === 'brand'
        ? colors.brandPrimary
        : `color-mix(in oklch, ${ink} 16%, ${colors.surfaceCard})`;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: bg }}>
      <Text variant="label" style={{ color: ink }}>
        {label}
      </Text>
    </View>
  );
}

/** Lista de pares etiqueta / valor en una tarjeta con separadores (Categoría, Cuenta, Fecha…). */
export function DefinitionList({ items }: { items: readonly { label: string; value: ReactNode }[] }) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, overflow: 'hidden' }}>
      {items.map((item, i) => (
        <View
          key={item.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[4],
            minHeight: 48,
            paddingHorizontal: space[4],
            paddingVertical: space[3] - 2,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <Text variant="bodySm" tone="secondary" style={{ width: 120 }}>
            {item.label}
          </Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            {typeof item.value === 'string' ? <Text variant="body">{item.value}</Text> : item.value}
          </View>
        </View>
      ))}
    </View>
  );
}
