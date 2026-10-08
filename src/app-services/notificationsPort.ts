// =============================================================================
// PUNTO DE INTEGRACION CON F4 (adaptador de notificaciones)
// =============================================================================
// F5a NO importa `src/platform/**` (lo implementa F4 en paralelo). Depende solo del contrato de
// arquitectura 7: `reconcile()` compara lo programado con lo deseado, es IDEMPOTENTE y se llama
// despues de cualquier comando que afecte recurrentes, deudas o ajustes.
//
// F4-INTEGRATION: el arranque de la app (por ejemplo `initializeApp` en startup.ts, o
// app/_layout.tsx) debe registrar el reconciliador de `src/platform/notifications.ts`.
//
// Mientras no haya ninguno registrado, `reconcileNotifications` no hace nada. El `reconcile` de F4
// recibe su entrada (`ReconcileInput`: ocurrencias, ajustes y `now`), asi que el registro debe
// envolverlo en un cierre sin argumentos que la construya con el dominio, por ejemplo:
//
//   registerNotificationReconciler(async () => {
//     await reconcile({
//       occurrences: getDomain().recurring.pendingOccurrences(),
//       settings: getDomain().settings.notificationSettings(),
//       now: Date.now(),
//     });
//   });
//
// Tambien pendiente de integrar (F4): `subscribeToNotificationResponses({ onNavigate, onSnooze })`
// con `onNavigate = router.push` y `onSnooze = (id) => commands.recurring.snooze(id)`; el comando
// ya ejecuta los efectos y, por tanto, reconcilia.

export type NotificationReconciler = () => Promise<void>;

let reconciler: NotificationReconciler | null = null;

export function registerNotificationReconciler(next: NotificationReconciler | null): void {
  reconciler = next;
}

/** Reconcilia las notificaciones. Un fallo se registra pero NUNCA rompe el comando que lo origino. */
export async function reconcileNotifications(): Promise<void> {
  if (!reconciler) return;
  try {
    await reconciler();
  } catch (error) {
    console.warn('No se pudieron reconciliar las notificaciones:', error);
  }
}
