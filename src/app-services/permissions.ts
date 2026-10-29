// Permiso de notificaciones al crear el primer recurrente con fecha (arquitectura 7).
import { reconcileNotifications } from './notificationsPort';

/**
 * Pide el permiso de notificaciones (el sistema solo pregunta si aun no se decidio) y, si queda
 * concedido, reconcilia: lo creado antes de conceder el permiso no se habia programado.
 * La plataforma se importa en diferido para no cargar `expo-notifications` al arrancar.
 * Un fallo se registra pero nunca rompe la pantalla.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const { ensureNotificationPermission: ensure } = await import('../platform/notifications');
    const granted = await ensure();
    if (granted) await reconcileNotifications();
    return granted;
  } catch (error) {
    console.warn('No se pudo pedir el permiso de notificaciones:', error);
    return false;
  }
}

/** Estado del permiso sin pedirlo (Ajustes lo lee al abrir). Import diferido, como arriba. */
export async function readNotificationPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  const { readNotificationPermission: read } = await import('../platform/notifications');
  return read();
}
