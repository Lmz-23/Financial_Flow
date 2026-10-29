// =============================================================================
// PUNTO DE INTEGRACION CON F4 (adaptador de notificaciones)
// =============================================================================
// F5a NO importa `src/platform/**` (lo implementa F4 en paralelo). Depende solo del contrato de
// arquitectura 7: `reconcile()` compara lo programado con lo deseado, es IDEMPOTENTE y se llama
// despues de cualquier comando que afecte recurrentes, deudas o ajustes.
//
// El arranque registra el reconciliador real (`startNotifications` en notificationsStartup.ts,
// llamado desde `initializeApp`). Mientras no haya ninguno registrado, `reconcileNotifications`
// no hace nada. Las respuestas a notificaciones se conectan con `subscribeToNotifications` (index.ts).

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
