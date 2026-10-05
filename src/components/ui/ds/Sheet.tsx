import type { ReactNode } from 'react';
import { Modal, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme';
import { SCREEN_MARGIN, SCRIM_COLOR } from './constants';

export interface SheetProps {
  visible: boolean;
  /** Se llama al tocar el velo o con el gesto/botón atrás de Android. */
  onClose: () => void;
  /** Nombre accesible de la hoja (p. ej. "Confirmar pago"). */
  accessibilityLabel?: string;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Hoja inferior: radio lg arriba, asa de 36x4, velo y la ÚNICA sombra del sistema (shadow-sheet,
 * ninguna en oscuro). Usa el Modal de React Native.
 */
export function Sheet({ visible, onClose, accessibilityLabel, children, contentStyle }: SheetProps) {
  const { colors, radius, space, shadowSheet } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: SCRIM_COLOR }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            {
              backgroundColor: colors.surfaceCard,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingTop: space[3],
              paddingHorizontal: SCREEN_MARGIN,
              paddingBottom: insets.bottom + space[5],
              alignItems: 'center',
              gap: SCREEN_MARGIN,
            },
            shadowSheet,
            contentStyle,
          ]}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ width: 36, height: 4, borderRadius: radius.full, backgroundColor: colors.borderSubtle }}
          />
          <View style={{ width: '100%' }}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}
