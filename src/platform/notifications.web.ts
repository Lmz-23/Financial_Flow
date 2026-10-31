// =============================================================================
// ADAPTADOR DE NOTIFICACIONES: variante web (escritorio)
// =============================================================================
//
// En escritorio las notificaciones quedan apagadas por ahora: expo-notifications no programa
// notificaciones locales en web. Mismas exportaciones que usa la app de `notifications.ts`, sin
// efectos: nada se programa y el permiso se reporta como no concedido. Cuando el escritorio tenga
// avisos propios (notificaciones de Windows), se implementan aqui.
// =============================================================================

import type { ReconcileInput, ReconcileResult, ResponseHandlers } from './notifications';

export type { ReconcileInput, ReconcileResult, ResponseAction, ResponseHandlers } from './notifications';

export async function setupNotifications(): Promise<void> {}

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

export async function readNotificationPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  return { granted: false, canAskAgain: false };
}

export async function reconcile(_input: ReconcileInput): Promise<ReconcileResult> {
  return { scheduled: 0, cancelled: 0, kept: 0, permitted: false };
}

export function subscribeToNotificationResponses(_handlers: ResponseHandlers): () => void {
  return () => {};
}
