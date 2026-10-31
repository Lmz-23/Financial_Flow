import { createElement } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '../../theme';
import type { SkeletonBlockProps } from './Skeleton';

export type { SkeletonBlockProps } from './Skeleton';

const STYLE_ID = 'ff-skeleton-style';

// Brillo plateado que recorre el bloque de izquierda a derecha. Sin animación si el sistema pide
// movimiento reducido.
const CSS = `
@keyframes ff-shimmer { from { background-position: 150% 0; } to { background-position: -50% 0; } }
.ff-skeleton {
  background-image: linear-gradient(90deg, transparent 0%, var(--ff-shine) 50%, transparent 100%);
  background-size: 60% 100%;
  background-repeat: no-repeat;
  animation: ff-shimmer 1.3s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) { .ff-skeleton { animation: none; } }
`;

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** Variante web de `SkeletonBlock`: el mismo bloque con el brillo animado (CSS). */
export function SkeletonBlock({ width = '100%', height, radius, style }: SkeletonBlockProps) {
  const { colors, radius: r, scheme } = useTheme();
  ensureStyles();
  const flat = StyleSheet.flatten(style) ?? {};
  return createElement('div', {
    className: 'ff-skeleton',
    'aria-hidden': true,
    style: {
      ...(flat as Record<string, unknown>),
      width: typeof width === 'number' ? `${width}px` : width,
      height,
      flexShrink: 0,
      borderRadius: radius ?? r.sm,
      backgroundColor: colors.borderSubtle,
      '--ff-shine': scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)',
    },
  });
}
