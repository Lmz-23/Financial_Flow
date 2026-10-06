import { forwardRef } from 'react';
import { TextInput } from 'react-native';

import { formatCOP, type Minor } from '../../../domain/money';
import { useTheme } from '../../../theme';
import { MONEY_FIELD_SIZE, MONEY_HERO_SIZE } from './constants';
import { Input, type InputProps } from './Input';
import { toneColor, type TextTone } from './tone';
import { inputTextFromMinor, minorFromInputText } from './utils';

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'defaultValue'> {
  /** Monto en UNIDADES MENORES (`Minor`, p. ej. 120000000 = $1.200.000). null = vacío. */
  value: Minor | null;
  /** Emite UNIDADES MENORES, o null si el campo queda vacío o el valor no es válido. */
  onChangeValue: (value: Minor | null) => void;
  /**
   * 'field' (por defecto): campo de formulario de 48 px con monto mono de 16 px.
   * 'hero': monto grande centrado sin caja (pantalla Nueva transacción), 44 px mono medio.
   */
  variant?: 'field' | 'hero';
  /** Solo para 'hero': color del monto ('debt' para gasto, 'growth' para ingreso). */
  tone?: Extract<TextTone, 'primary' | 'growth' | 'debt'>;
}

/**
 * Entrada de monto: IBM Plex Mono. CONTRATO: `value` y `onChangeValue` son unidades menores
 * (Minor) o null. El texto mostrado lo produce `formatCOP` y lo que escribe el usuario se
 * interpreta con `parseMinor` (ambos de src/domain/money.ts; no hay formato propio). Sin
 * decimales (COP del MVP): los dígitos escritos son pesos enteros.
 */
export const MoneyInput = forwardRef<TextInput, MoneyInputProps>(function MoneyInput(
  { value, onChangeValue, variant = 'field', tone = 'primary', placeholder = formatCOP(0), inputStyle, containerStyle, ...rest },
  ref,
) {
  const { type, colors } = useTheme();
  const isHero = variant === 'hero';

  return (
    <Input
      {...rest}
      ref={ref}
      value={inputTextFromMinor(value)}
      onChangeText={(text) => onChangeValue(minorFromInputText(text))}
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
