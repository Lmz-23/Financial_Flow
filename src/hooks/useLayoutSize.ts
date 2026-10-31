import { Platform, useWindowDimensions } from 'react-native';

import { layoutSizeFor, type LayoutSize } from '../lib/layoutSize';

/**
 * Tamaño de diseño de la ventana actual; cambia en vivo al redimensionar. En el celular (iOS y
 * Android) siempre es 'compact': el diseño de escritorio es solo para la versión web/Electron.
 */
export function useLayoutSize(): LayoutSize {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return 'compact';
  return layoutSizeFor(width);
}

/** true cuando la app usa el armazón de escritorio (menú lateral y ventanas centradas). */
export function useIsDesktop(): boolean {
  return useLayoutSize() !== 'compact';
}
