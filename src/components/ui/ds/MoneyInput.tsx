import { forwardRef } from 'react';
import { TextInput } from 'react-native';

import { useTheme } from '../../../theme';
import { MONEY_FIELD_SIZE, MONEY_HERO_SIZE } from './constants';
import { Input, type InputProps } from './Input';
import { toneColor, type TextTone } from './tone';
import { digitsOnly, formatDigitsAsCurrency } from './utils';

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'defaultValue'> {
  /** Solo dígitos, en unidades de moneda (p. ej. '1200000'). Vacío = sin valor. */
  value: string;
  /** Recibe SOLO dígitos (sin '$', puntos ni espacios). Parsear/convertir es cosa del dominio. */
  onChangeValue: (digits: string) => void;
  /**
   * 'field' (por defecto): campo de formulario de 48 px con monto mono de 16 px.
   * 'hero': monto grande centrado sin caja (pantalla Nueva transacción), 44 px mono medio.
   */
  variant?: 'field' | 'hero';
  /** Solo para 'hero': color del monto ('debt' para gasto, 'growth' para ingreso). */
  tone?: Extract<TextTone, 'primary' | 'growth' | 'debt'>;
}

/**
 * Entrada de monto: IBM Plex Mono, muestra '$1.200.000' y emite solo dígitos. Sin decimales
 * (COP del MVP). No contiene lógica de negocio.
 */
export const MoneyInput = forwardRef<TextInput, MoneyInputProps>(function MoneyInput(
  { value, onChangeValue, variant = 'field', tone = 'primary', placeholder = '$0', inputStyle, containerStyle, ...rest },
  ref,
) {
  const { type, colors } = useTheme();
  const isHero = variant === 'hero';

  return (
    <Input
      {...rest}
      ref={ref}
      value={formatDigitsAsCurrency(value)}
      onChangeText={(text) => onChangeValue(digitsOnly(text))}
      keyboardType="number-pad"
      inputMode="numeric"
      placeholder={placeholder}
      containerStyle={containerStyle}
      inputStyle={[
        isHero
          ? {
              ...type.amountLg,
              fontSize: MONEY_HERO_SIZE,
              lineHeight: MONEY_HERO_SIZE + 4,
              textAlign: 'center',
              color: toneColor(colors, tone, MONEY_HERO_SIZE),
              borderWidth: 0,
              backgroundColor: 'transparent',
              height: MONEY_HERO_SIZE + 16,
            }
          : { ...type.amountSm, fontSize: MONEY_FIELD_SIZE, lineHeight: undefined },
        inputStyle,
      ]}
    />
  );
});
