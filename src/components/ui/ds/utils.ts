/**
 * Helpers PUROS de las primitivas del Design System (sin react-native: se prueban en vitest).
 *
 * Los montos son SIEMPRE unidades menores (`Minor`, como en BD). El único formateador de
 * pesos es `formatCOP` de src/domain/money.ts: aquí no se formatea dinero por cuenta propia.
 */
import { formatCOP, MINOR_PER_PESO, parseMinor, type Minor } from '../../../domain/money';

export type AmountTone = 'auto' | 'neutral' | 'growth' | 'debt' | 'goal';
export type ResolvedAmountTone = Exclude<AmountTone, 'auto'>;

export interface AmountDisplay {
  text: string;
  tone: ResolvedAmountTone;
}

/**
 * Texto y tono de un monto con signo, en unidades menores.
 * - Texto: `formatCOP` (el negativo ya lleva '-'); '+' solo si `showSign` (por defecto, solo
 *   con tone 'auto').
 * - tone 'auto': positivo -> growth, negativo -> debt, cero -> neutral (el color depende del DATO).
 * - Un monto que se muestra como 0 pesos (p. ej. -40 menores) no lleva signo y cuenta como cero.
 */
export function amountDisplay(
  minor: Minor,
  options: { tone?: AmountTone; showSign?: boolean } = {},
): AmountDisplay {
  const { tone = 'neutral' } = options;
  const showSign = options.showSign ?? tone === 'auto';
  // formatCOP redondea al peso: el signo y el tono siguen a lo que se muestra.
  const shownPesos = Math.round(Math.abs(minor) / MINOR_PER_PESO);
  const direction = shownPesos === 0 ? 0 : minor < 0 ? -1 : 1;
  const resolved: ResolvedAmountTone =
    tone === 'auto' ? (direction > 0 ? 'growth' : direction < 0 ? 'debt' : 'neutral') : tone;
  const body = formatCOP(minor);
  return { text: direction > 0 && showSign ? `+${body}` : body, tone: resolved };
}

/** Deja solo dígitos ('1.200,5' -> '12005'). */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * Texto escrito en un campo de monto -> unidades menores. Se interpretan solo los dígitos como
 * pesos enteros (el MVP no tiene decimales). Vacío o fuera del rango entero seguro -> null.
 */
export function minorFromInputText(text: string): Minor | null {
  const digits = digitsOnly(text);
  if (digits === '') return null;
  const minor = parseMinor(digits);
  return minor !== null && Number.isSafeInteger(minor) ? minor : null;
}

/** Valor del campo de monto (unidades menores) -> texto mostrado; null -> ''. */
export function inputTextFromMinor(value: Minor | null): string {
  return value === null ? '' : formatCOP(value);
}

/** Limita un porcentaje a [0, 100]; NaN/Infinity cuentan como 0. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
