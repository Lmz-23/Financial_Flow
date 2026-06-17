// =============================================================================
// CURRENCY UTILITIES
// =============================================================================

/**
 * Formats a number as Colombian Pesos (COP) currency.
 * Uses Intl.NumberFormat for proper locale formatting.
 *
 * @example
 * formatCOP(1500000)  // "$1.500.000"
 * formatCOP(-50000)   // "$-50.000"
 * formatCOP(0)       // "$0"
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a number as Colombian Pesos in a short format for compact UI.
 *
 * @example
 * formatCOPShort(1500000)  // "$1.5M"
 * formatCOPShort(250000)   // "$250k"
 * formatCOPShort(50000)    // "$50k"
 * formatCOPShort(-75000)   // "$-75k"
 */
export function formatCOPShort(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    return `${sign}$${(absAmount / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }

  if (absAmount >= 1_000_000) {
    return `${sign}$${(absAmount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (absAmount >= 1_000) {
    return `${sign}$${Math.round(absAmount / 1_000)}k`;
  }

  return `${sign}$${absAmount}`;
}

/**
 * Parses a COP formatted string back to a number.
 * Useful for form inputs.
 *
 * @example
 * parseCOP("$1.500.000")  // 1500000
 * parseCOP("1.500.000")   // 1500000
 * parseCOP("1500000")     // 1500000
 */
export function parseCOP(value: string): number {
  // Remove everything except digits and minus sign
  const cleaned = value.replace(/[^\d-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Converts a decimal amount (e.g., 1.5) to cents (e.g., 150).
 * Use for precise financial calculations.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Converts cents back to decimal amount.
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Formats an amount with sign prefix for display.
 *
 * @example
 * formatWithSign(50000, 'income')   // "+$50.000"
 * formatWithSign(-30000, 'expense')  // "-$30.000"
 */
export function formatWithSign(
  amount: number,
  type: 'income' | 'expense'
): string {
  const formatted = formatCOP(Math.abs(amount));
  if (type === 'income') {
    return `+${formatted}`;
  }
  return `-${formatted}`;
}
