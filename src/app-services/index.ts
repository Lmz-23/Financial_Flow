// Capa de aplicacion (arquitectura 4.1): comandos que llaman al dominio y ejecutan los efectos
// tras el COMMIT. Las pantallas y los hooks entran por aqui; nunca importan `src/database/**`.
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

export { getDomain } from './domain';
export { initializeApp, refreshSettings, subscribeToForeground } from './startup';
export { registerNotificationReconciler, reconcileNotifications } from './notificationsPort';
export type { Commands } from './commands';
