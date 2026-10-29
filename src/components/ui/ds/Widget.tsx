import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '../../../theme';
import { HERO_PADDING } from './constants';

export interface WidgetProps extends ViewProps {
  /** 'hero' = radio lg y más aire (p. ej. Índice de Flujo de Caja). Por defecto 'default' (radio md). */
  variant?: 'default' | 'hero';
  /** Separación entre hijos (space-3 = 12 por defecto). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Contenedor de widget/tarjeta: surface-card, borde border-subtle, SIN sombra (los widgets nunca
 * llevan sombra; la jerarquía se expresa con surface-raised y border-subtle).
 */
export function Widget({ variant = 'default', gap, style, children, ...rest }: WidgetProps) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: variant === 'hero' ? radius.lg : radius.md,
          padding: variant === 'hero' ? HERO_PADDING : space[4],
          gap: gap ?? space[3],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
