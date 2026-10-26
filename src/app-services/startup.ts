// Arranque de la aplicacion: migraciones + semilla, carga de la cache de ajustes y notificaciones.
import { AppState } from 'react-native';

import { initializeDatabase } from '../database/initialize';
import { useInvalidation } from '../store/useInvalidation';
import { useSettingsStore } from '../store/useSettingsStore';
import { getDomain } from './domain';
import { reconcileNotifications } from './notificationsPort';
import { startNotifications } from './notificationsStartup';

/** Vuelve a leer los ajustes de SQLite y actualiza la cache (la fuente de verdad es la BD). */
export function refreshSettings(): void {
  useSettingsStore.getState().setFromRow(getDomain().settings.get());
}

/** Idempotente (comparte la promesa de `initializeDatabase`). Deja los ajustes en el store. */
export async function initializeApp(): Promise<void> {
  await initializeDatabase();
  refreshSettings();
  // Sin await: las notificaciones nunca retienen la pantalla de carga.
  void startNotifications();
}

/**
 * Al volver a primer plano se invalida todo y se reconcilian las notificaciones: el mes en curso,
 * "Hoy/Ayer", el estado de los proximos pagos y lo que queda por avisar dependen del reloj, no de
 * un comando. Devuelve la funcion para desuscribirse.
 */
export function subscribeToForeground(): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    useInvalidation.getState().invalidateAll();
    void reconcileNotifications();
  });
  return () => subscription.remove();
}
