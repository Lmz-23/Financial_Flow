import { useCallback, useState } from 'react';

import { useTheme } from '../../../theme';
import { FOCUS_RING_OFFSET, FOCUS_RING_WIDTH } from './constants';

/** Solo propiedades de contorno: asignable tanto a estilos de View como de TextInput. */
interface FocusRingStyle {
  outlineColor: string;
  outlineWidth: number;
  outlineOffset: number;
  outlineStyle: 'solid';
}

/**
 * Estado de foco de teclado/lector para controles interactivos: devuelve los handlers para
 * `onFocus`/`onBlur` y el estilo de contorno con el token `focus-ring` (solo mientras hay foco).
 */
export function useFocusRing() {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const style: FocusRingStyle | undefined = focused
    ? {
        outlineColor: colors.focusRing,
        outlineWidth: FOCUS_RING_WIDTH,
        outlineOffset: FOCUS_RING_OFFSET,
        outlineStyle: 'solid',
      }
    : undefined;
  return { focused, onFocus, onBlur, style };
}
