import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  /** Acción destructiva (rojo en iOS). */
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * Confirmación de dos botones. En el celular es el `Alert` de siempre; en web `Alert.alert` de
 * react-native-web no hace nada, así que se usa el diálogo del navegador.
 */
export function confirmAction({ title, message, confirmLabel, destructive = true, onConfirm }: ConfirmOptions): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
