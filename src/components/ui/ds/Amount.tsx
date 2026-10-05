import type { TextProps as RNTextProps } from 'react-native';

import { Text } from './Text';
import { amountDisplay, formatCurrency, type AmountTone } from './utils';

export interface AmountProps extends Omit<RNTextProps, 'children'> {
  /**
   * Monto con signo en unidades de moneda (p. ej. pesos). La conversión desde unidades menores
   * (centavos) es responsabilidad de quien llama (src/domain/money.ts).
   */
  value: number;
  /** 'amountLg' (hero), 'amountMd' (secundario) o 'amountSm' (listas). Por defecto 'amountSm'. */
  variant?: 'amountLg' | 'amountMd' | 'amountSm';
  /**
   * 'neutral' (tinta, por defecto), 'auto' (verde si > 0, terracota si < 0: el color sigue al
   * dato) o un tono de señal explícito. Los colores de señal solo para datos financieros reales.
   */
  tone?: AmountTone;
  /** Mostrar '+' en positivos. Por defecto solo con tone 'auto'. El '-' siempre se muestra. */
  showSign?: boolean;
  /** Formateador del valor absoluto. Por defecto '$' + miles con punto, sin decimales. */
  format?: (absValue: number) => string;
}

const SIGNAL = { growth: 'growth', debt: 'debt', goal: 'goal', neutral: 'primary' } as const;

export function Amount({
  value,
  variant = 'amountSm',
  tone = 'neutral',
  showSign,
  format = formatCurrency,
  ...rest
}: AmountProps) {
  const display = amountDisplay(value, { tone, showSign, format });
  return (
    <Text {...rest} variant={variant} tone={SIGNAL[display.tone]}>
      {display.text}
    </Text>
  );
}
