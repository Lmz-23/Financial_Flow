import { useEffect, type ReactNode } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../../theme';

export const DIALOG_WIDTH = 560;
const DIALOG_MAX_HEIGHT = 760;
const DIALOG_MARGIN = 32;
const SCRIM = 'rgba(3,8,6,0.66)';

/**
 * Ventana centrada de escritorio (Design/escritorio, 2c): oscurece la pantalla de atrás y muestra el
 * formulario en una tarjeta de 560 px. Esc o un clic fuera la cierran (`onClose`, normalmente volver).
 * La pantalla de adentro conserva su propio layout (cabecera, scroll y botón inferior).
 */
export function DesktopDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { colors, radius } = useTheme();
  const { height } = useWindowDimensions();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // En captura y sin propagar: si la ventana está sobre un panel de detalle, Esc cierra solo la ventana.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Cerrar ventana"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: SCRIM, cursor: 'auto' }}
      />
      <View
        accessibilityViewIsModal
        style={{
          width: DIALOG_WIDTH,
          maxWidth: '100%',
          height: Math.min(DIALOG_MAX_HEIGHT, height - DIALOG_MARGIN * 2),
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.surfacePage,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}
