import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../../theme';
import { MIN_TOUCH } from './constants';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface ListRowProps {
  title: string;
  /** Segunda línea (fecha, categoría). Bajo 14 px se pinta en ink-primary por regla del sistema. */
  subtitle?: string;
  /** Adorno a la izquierda (ícono, punto de estado). */
  leading?: ReactNode;
  /** Contenido a la derecha (normalmente un <Amount />). */
  trailing?: ReactNode;
  /** Si se define, la fila es pulsable. */
  onPress?: () => void;
  /** Línea separadora inferior en border-subtle (filas de transacciones). */
  divider?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Fila de lista: título/subtítulo a la izquierda, contenido a la derecha, mínimo 44 px de alto. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  divider = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ListRowProps) {
  const { colors, space } = useTheme();
  const ring = useFocusRing();

  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="body">{title}</Text>
        {subtitle ? <Text variant="label" tone="secondary">{subtitle}</Text> : null}
      </View>
      {trailing}
    </>
  );

  const rowStyle: ViewStyle = {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: divider ? 1 : 0,
    borderBottomColor: colors.borderSubtle,
  };

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={[rowStyle, style]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.7 : 1 }, ring.style, style]}
    >
      {content}
    </Pressable>
  );
}
