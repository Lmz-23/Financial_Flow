import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../../theme';
import { clampPercent } from './utils';

export interface ProgressBarProps {
  /** Avance de 0 a 100 (se limita a ese rango). */
  progress: number;
  /**
   * Color de la barra. 'brand' (por defecto) es neutro; 'growth' / 'debt' / 'goal' son colores de
   * señal y solo se usan cuando la barra representa un dato real (pago de deuda, meta de ahorro).
   */
  tone?: 'brand' | 'growth' | 'debt' | 'goal';
  /** Alto en px (el diseño usa 6, 8 o 10). Por defecto 8. */
  height?: number;
  /** Nombre accesible, p. ej. "Progreso de Fondo de emergencia". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ progress, tone = 'brand', height = 8, accessibilityLabel, style }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const pct = clampPercent(progress);
  const fill =
    tone === 'growth' ? colors.signalGrowth : tone === 'debt' ? colors.signalDebt : tone === 'goal' ? colors.signalGoal : colors.brandPrimary;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[{ width: '100%', height, borderRadius: radius.full, backgroundColor: colors.borderSubtle, overflow: 'hidden' }, style]}
    >
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: fill }} />
    </View>
  );
}
