import type { TextProps as RNTextProps } from 'react-native';

import type { Minor } from '../../../domain/money';
import { Text } from './Text';
import { amountDisplay, type AmountTone } from './utils';

export interface AmountProps extends Omit<RNTextProps, 'children'> {
  /**
   * Monto con signo en UNIDADES MENORES (`Minor`, como se guarda en BD). El texto lo produce
   * `formatCOP` (src/domain/money.ts); este componente no formatea pesos por su cuenta.
   */
  value: Minor;
  /** 'amountLg' (hero), 'amountMd' (secundario) o 'amountSm' (listas). Por defecto 'amountSm'. */
  variant?: 'amountLg' | 'amountMd' | 'amountSm';
  /**
   * 'neutral' (tinta, por defecto), 'auto' (verde si > 0, terracota si < 0: el color sigue al
   * dato) o un tono de señal explícito. Los colores de señal solo para datos financieros reales.
   */
  tone?: AmountTone;
  /** Mostrar '+' en positivos. Por defecto solo con tone 'auto'. El '-' siempre se muestra. */
  showSign?: boolean;
}

const SIGNAL = { growth: 'growth', debt: 'debt', goal: 'goal', neutral: 'primary' } as const;

export function Amount({
  value,
  variant = 'amountSm',
  tone = 'neutral',
  showSign,
  ...rest
}: AmountProps) {
  const display = amountDisplay(value, { tone, showSign });
  return (
    <Text {...rest} variant={variant} tone={SIGNAL[display.tone]}>
      {display.text}
    </Text>
  );
}
