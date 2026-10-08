// Capa de aplicacion (arquitectura 4.1): comandos que llaman al dominio y ejecutan los efectos
// tras el COMMIT. Las pantallas y los hooks entran por aqui; nunca importan `src/database/**`.
import { useInvalidation } from '../store/useInvalidation';
import { createCommands } from './commands';
import { getDomain } from './domain';
import { runEffects } from './effects';
import { reconcileNotifications } from './notificationsPort';
import { refreshSettings } from './startup';

export const commands = createCommands(getDomain, (effects) =>
  runEffects(effects, {
    invalidate: (keys) => {
      // La cache de ajustes se recarga ANTES de avisar a los hooks para que lean valores nuevos.
      if (keys.includes('settings')) refreshSettings();
      useInvalidation.getState().invalidate(keys);
    },
    reconcile: reconcileNotifications,
  }),
);

export { getDomain } from './domain';
export { initializeApp, refreshSettings, subscribeToForeground } from './startup';
export { registerNotificationReconciler, reconcileNotifications } from './notificationsPort';
export type { Commands } from './commands';
