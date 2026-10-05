import { inkFor } from '../../../theme/theme';
import type { ColorTokens } from '../../../theme/tokens';

/**
 * Tonos de color de texto.
 * - primary / secondary: tinta. `secondary` solo se respeta con texto de 14 px o más; con menos
 *   tamaño cae a `primary` (regla del Design System, ver inkFor).
 * - onBrand: texto sobre brand-primary. brand: texto de marca (enlaces como "Ver detalle").
 * - growth / debt / goal: colores de SEÑAL. Solo para dato financiero real (ingreso, deuda/gasto,
 *   meta), nunca decoración.
 */
export type TextTone = 'primary' | 'secondary' | 'onBrand' | 'brand' | 'growth' | 'debt' | 'goal';

export function toneColor(colors: ColorTokens, tone: TextTone, fontSize: number): string {
  switch (tone) {
    case 'primary':
      return colors.inkPrimary;
    case 'secondary':
      return inkFor(colors, fontSize, 'secondary');
    case 'onBrand':
      return colors.inkOnBrand;
    case 'brand':
      return colors.brandPrimary;
    case 'growth':
      return colors.signalGrowth;
    case 'debt':
      return colors.signalDebt;
    case 'goal':
      return colors.signalGoal;
  }
}
