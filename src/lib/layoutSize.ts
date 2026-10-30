/**
 * Tamaño de diseño según el ancho de la ventana (versión de escritorio).
 *
 * - compact: menos de 600 px. El diseño del celular, sin cambios.
 * - medium: de 600 a 1024 px (ventana pequeña). Menú lateral y una columna más ancha.
 * - wide: más de 1024 px. Diseño completo de escritorio.
 */
export type LayoutSize = 'compact' | 'medium' | 'wide';

export const MEDIUM_MIN_WIDTH = 600;
export const WIDE_MIN_WIDTH = 1025;

export function layoutSizeFor(width: number): LayoutSize {
  if (width >= WIDE_MIN_WIDTH) return 'wide';
  if (width >= MEDIUM_MIN_WIDTH) return 'medium';
  return 'compact';
}
