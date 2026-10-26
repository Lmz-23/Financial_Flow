// Arranque de notificaciones: conecta el adaptador de `src/platform/notifications.ts` con el
// dominio (arquitectura 7). Cierra la integracion F4 descrita en `notificationsPort.ts`.
import { reconcile, setupNotifications } from '../platform/notifications';
import { getDomain } from './domain';
import { reconcileNotifications, registerNotificationReconciler } from './notificationsPort';

/**
 * Registra el reconciliador (sincrono, antes de cualquier espera: un comando temprano ya concilia),
 * configura handler de primer plano, canal y categoria, y concilia una vez. No pide permisos (ver
 * `ensureNotificationPermission`). No lanza; el arranque no debe esperarla (un modulo nativo colgado
 * dejaria la pantalla de carga para siempre).
 */
export async function startNotifications(): Promise<void> {
  registerNotificationReconciler(async () => {
    const domain = getDomain();
    await reconcile({
      occurrences: domain.recurring.pendingOccurrences(),
      settings: domain.settings.notificationSettings(),
      now: Date.now(),
    });
  });
  try {
    await setupNotifications();
  } catch (error) {
    console.warn('No se pudieron configurar las notificaciones', error instanceof Error ? error.name : typeof error);
  }
  await reconcileNotifications();
}
