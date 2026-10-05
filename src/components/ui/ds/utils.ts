/**
 * Helpers PUROS de las primitivas del Design System (sin react-native: se prueban en vitest).
 */

/** Agrupa miles con punto (es-CO). No usa Intl: no depende del soporte de Hermes por plataforma. */
export function groupThousands(integer: number): string {
  return String(Math.trunc(Math.abs(integer))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** '$' + es-CO sin decimales (COP). Recibe un valor ABSOLUTO en unidades de moneda (no menores). */
export function formatCurrency(absValue: number): string {
  return `$${groupThousands(Math.round(Math.abs(absValue)))}`;
}

export type AmountTone = 'auto' | 'neutral' | 'growth' | 'debt' | 'goal';
export type ResolvedAmountTone = Exclude<AmountTone, 'auto'>;

export interface AmountDisplay {
  text: string;
  tone: ResolvedAmountTone;
}

/**
 * Texto y tono de un monto con signo.
 * - tone 'auto': positivo -> growth, negativo -> debt, cero -> neutral (el color depende del DATO).
 * - Signo: el negativo siempre lleva '-'; el '+' solo si `showSign` (por defecto, solo con 'auto').
 *   Igual que el diseño: '+$160.000' / '-$85.000'.
 * - El redondeo a entero usa el valor absoluto, así que -0.4 se muestra como '$0' sin signo.
 */
export function amountDisplay(
  value: number,
  options: { tone?: AmountTone; showSign?: boolean; format?: (absValue: number) => string } = {},
): AmountDisplay {
  const { tone = 'neutral', format = formatCurrency } = options;
  const showSign = options.showSign ?? tone === 'auto';
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : rounded > 0 && showSign ? '+' : '';
  const resolved: ResolvedAmountTone =
    tone === 'auto' ? (rounded > 0 ? 'growth' : rounded < 0 ? 'debt' : 'neutral') : tone;
  return { text: `${sign}${format(Math.abs(value))}`, tone: resolved };
}

/** Deja solo dígitos ('1.200,5' -> '12005'). */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

/** '1200000' -> '$1.200.000'; '' -> ''. Los ceros a la izquierda se descartan. */
export function formatDigitsAsCurrency(digits: string): string {
  const clean = digitsOnly(digits);
  if (clean === '') return '';
  return formatCurrency(Number(clean));
}

/** Limita un porcentaje a [0, 100]; NaN/Infinity cuentan como 0. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
