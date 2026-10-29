import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme';
import { SCREEN_MARGIN } from '../ui/ds/constants';

/** true mientras el teclado está abierto (Android usa los eventos «Did»; iOS también los emite). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * Contenedor de pantallas con formulario. Con edge-to-edge (Android, SDK 56) la ventana ya no se
 * redimensiona sola al abrir el teclado, así que se usa behavior 'padding' en ambas plataformas:
 * el contenido sube la altura del teclado y el pie fijo queda justo encima.
 */
export function KeyboardScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surfacePage }} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * Pie fijo con botones. Reserva la barra de navegación (insets.bottom) solo con el teclado cerrado:
 * con el teclado abierto este ya la cubre y el relleno extra dejaría un hueco.
 */
export function KeyboardFooter({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  return (
    <View
      style={{
        paddingTop: space[4],
        paddingHorizontal: SCREEN_MARGIN,
        paddingBottom: keyboardVisible ? space[3] : Math.max(insets.bottom, 28),
      }}
    >
      {children}
    </View>
  );
}
