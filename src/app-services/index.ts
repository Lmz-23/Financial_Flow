// Capa de aplicacion (arquitectura 4.1): comandos que llaman al dominio y ejecutan los efectos
// tras el COMMIT. Las pantallas y los hooks entran por aqui; nunca importan `src/database/**`.
import { subscribeToNotificationResponses } from '../platform/notifications';
import { useInvalidation } from '../store/useInvalidation';
import { createCommands } from './commands';
import { getDomain } from './domain';
import { invalidateAfterCommit, runEffects } from './effects';
import { reconcileNotifications } from './notificationsPort';
import { refreshSettings } from './startup';

export const commands = createCommands(getDomain, (effects) =>
  runEffects(effects, {
    invalidate: (keys) =>
      invalidateAfterCommit(keys, refreshSettings, (k) => useInvalidation.getState().invalidate(k)),
    reconcile: reconcileNotifications,
  }),
);

/**
 * Respuestas a notificaciones: tocar o "Ya pagué" navega; "Todavía no" aplaza con el comando, que
 * ya reconcilia. Devuelve la funcion para quitar el listener.
 */
export function subscribeToNotifications(onNavigate: (href: string) => void): () => void {
  return subscribeToNotificationResponses({
    onNavigate,
    onSnooze: (recurringId) => {
      commands.recurring.snooze(recurringId);
    },
  });
}

export { getDomain } from './domain';
export { initializeApp, refreshSettings, subscribeToForeground } from './startup';
export { registerNotificationReconciler, reconcileNotifications } from './notificationsPort';
export { ensureNotificationPermission } from '../platform/notifications';
export type { Commands } from './commands';
